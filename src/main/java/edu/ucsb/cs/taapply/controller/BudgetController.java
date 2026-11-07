package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.services.BudgetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Budget for Quarter page (issue #177): the quarters to choose from, and for one quarter the
 * budget lines and everything derived from them. Planning figures, so none of it is audited.
 */
@Tag(name = "Budget")
@RequestMapping("/api/admin/budget")
@RestController
public class BudgetController extends ApiController {

  @Autowired BudgetService budgetService;
  @Autowired BudgetRepository budgetRepository;
  @Autowired ClientActivityDetector clientActivityDetector;

  @Operation(
      summary = "The quarters that have a recruitment, most recent first",
      description = "Each says whether it has a TA recruitment and whether it has a ULA one.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/quarters")
  public List<BudgetService.QuarterSummary> quarters() {
    return budgetService.quarters();
  }

  @Operation(
      summary = "One quarter's budget and the figures derived from it",
      description =
          "The budget row (created on first read as a copy of the most recent earlier quarter's,"
              + " or at zero when there is none), each recruitment's hiring target, cost per"
              + " position, allocation and enrollment totals, and the anticipated expenses, funds"
              + " and bottom line. 404 when the quarter has no recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public BudgetService.Summary summary(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20264") @RequestParam
          String quarter) {
    return budgetService.summary(quarter);
  }

  @Operation(
      summary = "Set one or more of a quarter's budget lines",
      description =
          "Any of the lines may be given: the three subzero lines, and (issue #388) the estimated"
              + " cost per TA per quarter, the ULA hourly rate, the estimated hours per ULA per"
              + " quarter and the other funds available for ASEs; and the conversionTAtoULA (issue #358, how many ULAs count as one TA on the"
              + " Combined Allocation page; greater than zero, else 400); the others keep their"
              + " values. Amounts are dollars and cents (the hours to two decimals) and must not be"
              + " negative. Returns the quarter's summary with the new figures, including the"
              + " estimated cost per ULA per quarter, the rate times the hours. The budget lines"
              + " and the conversion factor are counted apart (issues #277 and #375): version is"
              + " the budget's version the page last saw, and goes up by one on every save of a"
              + " line; conversionVersion is the factor's, and goes up by one on every save of the"
              + " factor. Each given one is compared only to its own count: if the lines (or the"
              + " factor) have been saved since, by another tab or admin, nothing is changed and"
              + " the answer is 409 Conflict with both counts and the summary as it now stands."
              + " Without a count the save is unconditional. A save that names its client"
              + " (X-Client-Id) also tells the server this tab or window is working on the budget,"
              + " for the multi-tab warning.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("")
  public ResponseEntity<Object> update(
      @Parameter(name = "quarter") @RequestParam String quarter,
      @Parameter(name = "version", description = "the budget lines' count the page last saw")
          @RequestParam(required = false)
          Integer version,
      @Parameter(
              name = "conversionVersion",
              description = "the conversion factor's count the page last saw")
          @RequestParam(required = false)
          Integer conversionVersion,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId,
      @Parameter(name = "unrestrictedBudget") @RequestParam(required = false)
          BigDecimal unrestrictedBudget,
      @Parameter(name = "tasOnlyBudget") @RequestParam(required = false) BigDecimal tasOnlyBudget,
      @Parameter(name = "ulasOnlyBudget") @RequestParam(required = false) BigDecimal ulasOnlyBudget,
      @Parameter(name = "taCostPerQuarter", description = "the estimated cost of one TA")
          @RequestParam(required = false)
          BigDecimal taCostPerQuarter,
      @Parameter(name = "ulaRateDollarsPerHour", description = "what one ULA is paid per hour")
          @RequestParam(required = false)
          BigDecimal ulaRateDollarsPerHour,
      @Parameter(
              name = "estimatedHoursPerULAPerQuarter",
              description = "how many hours one ULA is expected to work in the quarter")
          @RequestParam(required = false)
          BigDecimal estimatedHoursPerULAPerQuarter,
      @Parameter(
              name = "giftFundsForASEs",
              description = "other funds available for ASEs, such as gift funds")
          @RequestParam(required = false)
          BigDecimal giftFundsForASEs,
      @Parameter(
              name = "conversionTAtoULA",
              description = "how many ULAs count as one TA; greater than zero")
          @RequestParam(required = false)
          Double conversionTAtoULA) {
    requireNotNegative("unrestrictedBudget", unrestrictedBudget);
    requireNotNegative("tasOnlyBudget", tasOnlyBudget);
    requireNotNegative("ulasOnlyBudget", ulasOnlyBudget);
    requireNotNegative("taCostPerQuarter", taCostPerQuarter);
    requireNotNegative("ulaRateDollarsPerHour", ulaRateDollarsPerHour);
    requireNotNegative("estimatedHoursPerULAPerQuarter", estimatedHoursPerULAPerQuarter);
    requireNotNegative("giftFundsForASEs", giftFundsForASEs);
    if (conversionTAtoULA != null
        && !(conversionTAtoULA > 0 && Double.isFinite(conversionTAtoULA))) {
      throw new IllegalArgumentException("conversionTAtoULA must be greater than zero");
    }

    synchronized (COMPARE_AND_SET) {
      Budget budget = budgetService.budgetFor(quarter);
      clientActivityDetector.note(resourceKey(quarter), clientId, identity());
      if (version != null && !version.equals(budget.getVersion())) {
        return conflict(quarter);
      }
      if (conversionVersion != null && !conversionVersion.equals(budget.getConversionVersion())) {
        return conflict(quarter);
      }
      boolean linesChanged = false;
      if (unrestrictedBudget != null) {
        budget.setUnrestrictedBudget(BudgetService.money(unrestrictedBudget));
        linesChanged = true;
      }
      if (tasOnlyBudget != null) {
        budget.setTasOnlyBudget(BudgetService.money(tasOnlyBudget));
        linesChanged = true;
      }
      if (ulasOnlyBudget != null) {
        budget.setUlasOnlyBudget(BudgetService.money(ulasOnlyBudget));
        linesChanged = true;
      }
      if (taCostPerQuarter != null) {
        budget.setTaCostPerQuarter(BudgetService.money(taCostPerQuarter));
        linesChanged = true;
      }
      if (ulaRateDollarsPerHour != null) {
        budget.setUlaRateDollarsPerHour(BudgetService.money(ulaRateDollarsPerHour));
        linesChanged = true;
      }
      if (estimatedHoursPerULAPerQuarter != null) {
        budget.setEstimatedHoursPerULAPerQuarter(
            BudgetService.money(estimatedHoursPerULAPerQuarter));
        linesChanged = true;
      }
      if (giftFundsForASEs != null) {
        budget.setGiftFundsForASEs(BudgetService.money(giftFundsForASEs));
        linesChanged = true;
      }
      if (linesChanged) {
        budget.setVersion(budget.getVersion() + 1);
      }
      if (conversionTAtoULA != null) {
        budget.setConversionTAtoULA(conversionTAtoULA);
        budget.setConversionVersion(budget.getConversionVersion() + 1);
      }
      budgetRepository.save(budget);
    }
    return ResponseEntity.ok(budgetService.summary(quarter));
  }

  /**
   * Makes the read, compare and write of a save one step as far as this server goes, so that two
   * saves cannot both pass the count check and both be written (the lines and the factor each have
   * a plain counter, issue #375, not a JPA version). The app runs as one instance (see the design
   * of issue #270), so that is enough, as it is for the compare-and-set in {@link
   * RecruitmentsController}.
   */
  private static final Object COMPARE_AND_SET = new Object();

  @Operation(
      summary =
          "Say that this tab or window still has the quarter's budget open, and learn who else does",
      description =
          "Changes nothing about the budget. Tells the server this client (X-Client-Id) is still"
              + " here, and answers with the other people who have the quarter's budget open (a"
              + " label for each, and whether it is the same person in another tab or window) and"
              + " how often to send this. Admins only; anyone else gets 403 and nothing is"
              + " recorded or told. 404 when the quarter has no recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/heartbeat")
  public Presence heartbeat(
      @Parameter(name = "quarter") @RequestParam String quarter,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // PreAuthorize has already refused everyone but admins, so nothing below runs for them.
    budgetService.budgetFor(quarter);
    return clientActivityDetector.heartbeat(resourceKey(quarter), clientId, identity());
  }

  @Operation(
      summary = "Say that this tab or window has left the quarter's budget",
      description =
          "Sent when a tab or window is closed or moves away, so that the others stop being warned"
              + " about it at once. Allowed to exactly those a heartbeat is (admins); anyone else"
              + " gets 403 and nothing is removed. The answer is 204 whether or not the client was"
              + " known.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(
      @Parameter(name = "quarter") @RequestParam String quarter,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    clientActivityDetector.leave(resourceKey(quarter), clientId);
  }

  /** The detector's name for one quarter's budget. */
  private static String resourceKey(String quarter) {
    return "budget:" + quarter;
  }

  /**
   * Who the current user is to the detector: the shared identity, marked as an admin (issue #302).
   */
  private ClientIdentity identity() {
    return ApplicationsController.identityOf(getCurrentUser().getUser(), true);
  }

  /** What a refused save tells the page: why, and the quarter as it now stands. */
  private ResponseEntity<Object> conflict(String quarter) {
    BudgetService.Summary current = budgetService.summary(quarter);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "This budget was changed in another tab or window. Use theirs, or overwrite with yours.");
    body.put("version", current.budget().getVersion());
    body.put("conversionVersion", current.budget().getConversionVersion());
    body.put("summary", current);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  private static void requireNotNegative(String name, BigDecimal amount) {
    if (amount != null && amount.signum() < 0) {
      throw new IllegalArgumentException("%s must not be negative".formatted(name));
    }
  }
}
