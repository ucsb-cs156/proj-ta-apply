package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.utilities.Sleep;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.DoubleSupplier;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

/**
 * Wraps calls to an external REST API with three defenses:
 *
 * <ul>
 *   <li><b>Pacing:</b> consecutive calls are kept at least {@code paceMs} apart, to stay under rate
 *       limits in the first place. The pacer only sleeps the <i>remaining</i> gap since the
 *       previous call, so an occasional interactive call is not delayed at all — only tight loops
 *       are slowed.
 *   <li><b>Backoff-retries on 5xx:</b> transient server errors are retried up to {@code retryMax}
 *       times, sleeping {@code retryInitialDelayMs} and doubling each time, with ±25% random jitter
 *       applied to each sleep (e.g. a 500ms step actually sleeps somewhere in [375ms, 625ms]) so
 *       that many callers backing off in lockstep don't all retry at the same instant. Only then
 *       does the call fail — with a one-line {@link ApiUnavailableException} instead of the
 *       provider's error page.
 *   <li><b>Rate-limit reaction:</b> a 429, or a 403 whose body mentions "rate limit", counts as a
 *       retryable event using the same doubling-plus-jitter backoff, and additionally doubles the
 *       pace <i>permanently</i> (for the life of the service instance), with a log suggestion to
 *       raise the pace's configuration variable. This satisfies API terms of service (e.g. Semantic
 *       Scholar's) that require exponential backoff on rate-limit responses. Callers whose provider
 *       is known to return bare 403s as an anti-bot measure instead of a proper 429 (e.g. {@code
 *       doi.org}) can opt every 403 into this same treatment via {@code
 *       treatAnyForbiddenAsRateLimit}.
 * </ul>
 *
 * <p>All other client errors (404 for a missing path, 401/403 for a bad token) are rethrown
 * untouched — callers depend on their semantics.
 */
@Slf4j
public class ApiRetryHelper {

  /** Each backoff sleep is jittered by up to ±25% of its (pre-jitter) doubled value. */
  private static final double JITTER_RATIO = 0.25;

  // Visible for tests: a real random value in [-1.0, 1.0), used as the production default. Named
  // and exposed as its own field (rather than an inline lambda) so its actual randomness can be
  // tested directly, rather than only indirectly through a retry loop's non-deterministic timing.
  static final DoubleSupplier DEFAULT_JITTER_FACTOR =
      () -> ThreadLocalRandom.current().nextDouble(-1.0, 1.0);

  private final String apiName;
  private final String paceVariableName;
  private final long retryInitialDelayMs;
  private final int retryMax;
  private final AtomicLong paceMs;
  private final AtomicLong lastCallMs = new AtomicLong(0);
  private final LongSupplier nowMs;
  private final DoubleSupplier jitterFactor;
  private final boolean treatAnyForbiddenAsRateLimit;

  /** Thrown when the API is still failing after all retries; carries a clean one-line message. */
  public static class ApiUnavailableException extends RuntimeException {
    public ApiUnavailableException(String message) {
      super(message);
    }
  }

  public ApiRetryHelper(
      String apiName,
      String paceVariableName,
      long retryInitialDelayMs,
      int retryMax,
      long paceInitialMs) {
    this(apiName, paceVariableName, retryInitialDelayMs, retryMax, paceInitialMs, false);
  }

  /**
   * Like the five-arg constructor, but with {@code treatAnyForbiddenAsRateLimit} set: pass {@code
   * true} when the provider is known to return bare 403s as an anti-bot measure instead of a proper
   * 429 (e.g. {@code doi.org}), so that every 403 — not just ones whose body mentions "rate limit"
   * — is treated as a rate-limit signal.
   */
  public ApiRetryHelper(
      String apiName,
      String paceVariableName,
      long retryInitialDelayMs,
      int retryMax,
      long paceInitialMs,
      boolean treatAnyForbiddenAsRateLimit) {
    this(
        apiName,
        paceVariableName,
        retryInitialDelayMs,
        retryMax,
        paceInitialMs,
        System::currentTimeMillis,
        DEFAULT_JITTER_FACTOR,
        treatAnyForbiddenAsRateLimit);
  }

  // Visible for tests: nowMs lets the pacing arithmetic run against a controlled clock, and
  // jitterFactor (a value in [-1.0, 1.0]) lets the backoff jitter be pinned to an exact,
  // deterministic value instead of real randomness.
  ApiRetryHelper(
      String apiName,
      String paceVariableName,
      long retryInitialDelayMs,
      int retryMax,
      long paceInitialMs,
      LongSupplier nowMs,
      DoubleSupplier jitterFactor) {
    this(
        apiName,
        paceVariableName,
        retryInitialDelayMs,
        retryMax,
        paceInitialMs,
        nowMs,
        jitterFactor,
        false);
  }

  ApiRetryHelper(
      String apiName,
      String paceVariableName,
      long retryInitialDelayMs,
      int retryMax,
      long paceInitialMs,
      LongSupplier nowMs,
      DoubleSupplier jitterFactor,
      boolean treatAnyForbiddenAsRateLimit) {
    this.apiName = apiName;
    this.paceVariableName = paceVariableName;
    this.retryInitialDelayMs = retryInitialDelayMs;
    this.retryMax = retryMax;
    this.paceMs = new AtomicLong(paceInitialMs);
    this.nowMs = nowMs;
    this.jitterFactor = jitterFactor;
    this.treatAnyForbiddenAsRateLimit = treatAnyForbiddenAsRateLimit;
  }

  /**
   * Runs {@code call}, pacing it relative to the previous call and retrying per the class contract.
   * {@code description} identifies the request in log messages, e.g. {@code "GET /works/doi:..."}.
   */
  public <T> T execute(String description, Supplier<T> call) {
    long delayMs = retryInitialDelayMs;
    int retriesUsed = 0;
    while (true) {
      pace();
      try {
        return call.get();
      } catch (HttpServerErrorException e) {
        if (retriesUsed >= retryMax) {
          throw new ApiUnavailableException(
              "%s API returned %d (%s) for %s; giving up after %d attempts"
                  .formatted(
                      apiName,
                      e.getStatusCode().value(),
                      e.getStatusText(),
                      description,
                      retriesUsed + 1));
        }
        long actualDelayMs = jitteredDelay(delayMs);
        log.info(
            "{} API returned {} for {}; sleeping {} ms before retrying",
            apiName,
            e.getStatusCode().value(),
            description,
            actualDelayMs);
        Sleep.sleepQuietly(actualDelayMs);
        delayMs *= 2;
        retriesUsed++;
      } catch (HttpClientErrorException e) {
        if (!isRateLimited(e)) {
          throw e;
        }
        long newPace = paceMs.updateAndGet(pace -> pace * 2);
        log.warn(
            "{} API rate limit hit for {}; inter-call pace doubled to {} ms — consider increasing {}",
            apiName,
            description,
            newPace,
            paceVariableName);
        if (retriesUsed >= retryMax) {
          throw new ApiUnavailableException(
              "%s API rate limit still in effect for %s; giving up after %d attempts (consider increasing %s)"
                  .formatted(apiName, description, retriesUsed + 1, paceVariableName));
        }
        Sleep.sleepQuietly(jitteredDelay(delayMs));
        delayMs *= 2;
        retriesUsed++;
      }
    }
  }

  /**
   * Applies up to ±{@value #JITTER_RATIO} random jitter to {@code baseDelayMs} (e.g. a 500ms base
   * actually sleeps somewhere in [375ms, 625ms]), per API terms-of-service requirements (e.g.
   * Semantic Scholar's) for randomized exponential backoff.
   */
  private long jitteredDelay(long baseDelayMs) {
    return Math.round(baseDelayMs + baseDelayMs * JITTER_RATIO * jitterFactor.getAsDouble());
  }

  /**
   * A 429; a 403 whose body mentions "rate limit" (GitHub's secondary-limit signature); or, when
   * {@code treatAnyForbiddenAsRateLimit} is set, any 403 at all (some providers, e.g. {@code
   * doi.org}, return a bare 403 as an anti-bot measure instead of a proper 429).
   */
  private boolean isRateLimited(HttpClientErrorException e) {
    if (e.getStatusCode().value() == 429) {
      return true;
    }
    if (e.getStatusCode().value() != 403) {
      return false;
    }
    return treatAnyForbiddenAsRateLimit
        || e.getResponseBodyAsString().toLowerCase().contains("rate limit");
  }

  /** Sleeps just long enough that consecutive calls are at least paceMs apart. */
  private void pace() {
    long now = nowMs.getAsLong();
    long previous = lastCallMs.getAndSet(now);
    long remaining = previous + paceMs.get() - now;
    if (remaining > 0) {
      Sleep.sleepQuietly(remaining);
      lastCallMs.set(nowMs.getAsLong());
    }
  }
}
