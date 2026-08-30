package edu.ucsb.cs.taapply.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.models.UcsbApiQuarter;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Derives the last quarter the admin Courses dropdowns should offer, from the quarter UCSB says it
 * currently is. Only {@code app.startQtrYYYYQ} needs configuring; the end of the range keeps itself
 * up to date as quarters roll over.
 *
 * <p>The rule is ported from proj-courses' {@code UCSBAPIQuarterService}: look ahead one quarter,
 * except in Spring, when look ahead two so that both Summer and Fall are offered.
 */
@Service
@Slf4j
public class UcsbQuarterService {

  @Autowired private ObjectMapper objectMapper;

  @Value("${app.ucsb.api.consumer_key}")
  private String apiKey;

  @Value("${app.ucsb.api.host}")
  private String apiHost;

  /** Used only when the UCSB API cannot be reached, so the dropdowns still render something. */
  @Value("${app.endQtrYYYYQ:20254}")
  private String endQtrFallback;

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration READ_TIMEOUT = Duration.ofSeconds(60);

  public static final String CURRENT_QUARTER_ENDPOINT =
      "{apiHost}/academics/quartercalendar/v1/quarters/current";

  /** The Q digit for Spring, the one quarter we look two ahead from. */
  static final int SPRING = 2;

  static final int CACHE_DURATION_HOURS = 24;

  private final RestTemplate restTemplate;

  private String cachedCurrentQuarter = null;
  private Instant cacheTime = null;

  public UcsbQuarterService(RestTemplateBuilder restTemplateBuilder) {
    this.restTemplate =
        restTemplateBuilder.connectTimeout(CONNECT_TIMEOUT).readTimeout(READ_TIMEOUT).build();
  }

  /** Forget the cached quarter entirely, so the next call hits the API. */
  void clearCurrentQuarterCache() {
    cachedCurrentQuarter = null;
    cacheTime = null;
  }

  /** Keep the cached value but treat it as stale, so the next call refreshes it. */
  void expireCurrentQuarterCache() {
    cacheTime = Instant.EPOCH;
  }

  String urlForCurrentQuarter() {
    return CURRENT_QUARTER_ENDPOINT.replace("{apiHost}", apiHost);
  }

  /**
   * The quarter UCSB says it currently is, in YYYYQ form. Cached for {@value #CACHE_DURATION_HOURS}
   * hours: this is asked for on every /api/systemInfo call, and the answer changes a handful of
   * times a year.
   */
  public String getCurrentQuarterYYYYQ() throws Exception {
    if (cachedCurrentQuarter != null
        && Instant.now().isBefore(cacheTime.plus(CACHE_DURATION_HOURS, ChronoUnit.HOURS))) {
      return cachedCurrentQuarter;
    }

    HttpHeaders headers = new HttpHeaders();
    headers.setAccept(Arrays.asList(MediaType.APPLICATION_JSON));
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("ucsb-api-version", "1.0");
    headers.set("ucsb-api-key", this.apiKey);

    HttpEntity<String> entity = new HttpEntity<>("body", headers);
    String url = urlForCurrentQuarter();
    log.info("url={}", url);

    ResponseEntity<String> re = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
    UcsbApiQuarter quarter = objectMapper.readValue(re.getBody(), UcsbApiQuarter.class);

    if (quarter == null || quarter.getQuarter() == null) {
      throw new IllegalStateException("UCSB API returned no current quarter");
    }

    cachedCurrentQuarter = quarter.getQuarter();
    cacheTime = Instant.now();
    return cachedCurrentQuarter;
  }

  /**
   * The last quarter to offer, given the current one: one quarter ahead, or two in Spring so that
   * both Summer and Fall are reachable.
   *
   * @throws IllegalArgumentException if currentQuarterYYYYQ is not a valid YYYYQ value
   */
  public static String endQuarterFor(String currentQuarterYYYYQ) {
    Quarter endQuarter = new Quarter(Quarter.yyyyqToInt(currentQuarterYYYYQ));
    int quartersToAdd = (endQuarter.getValue() % 10 == SPRING) ? 2 : 1;
    for (int i = 0; i < quartersToAdd; i++) {
      endQuarter.increment();
    }
    return endQuarter.getYYYYQ();
  }

  /**
   * The end of the range for the quarter dropdowns. Falls back to {@code app.endQtrYYYYQ} if the
   * UCSB API is unreachable or returns something unusable, so a bad upstream degrades the range
   * rather than breaking the page.
   */
  public String getEndQtrYYYYQ() {
    try {
      return endQuarterFor(getCurrentQuarterYYYYQ());
    } catch (Exception e) {
      log.error("Could not derive end quarter from the UCSB API; using {}", endQtrFallback, e);
      return endQtrFallback;
    }
  }
}
