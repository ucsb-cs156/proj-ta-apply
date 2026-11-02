package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.User;
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
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
          "The budget row (created at zero on first read), each recruitment's hiring target, cost"
              + " per position, allocation and enrollment totals, and the anticipated expenses,"
              + " funds and bottom line. 404 when the quarter has no recruitment.")
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
          "Any of the three may be given; the others keep their values. Amounts are dollars and"
              + " cents and must not be negative. Returns the quarter's summary with the new"
              + " figures. The version is the one the page last saw (issue #277): if the budget"
              + " has been saved since, by another tab or admin, nothing is changed and the answer"
              + " is 409 Conflict with the summary as it now stands. Without a version the save"
              + " is unconditional. A save that names its client (X-Client-Id) also tells the"
              + " server this tab or window is working on the budget, for the multi-tab warning.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("")
  public ResponseEntity<Object> update(
      @Parameter(name = "quarter") @RequestParam String quarter,
      @Parameter(name = "version") @RequestParam(required = false) Integer version,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId,
      @Parameter(name = "unrestrictedBudget") @RequestParam(required = false)
          BigDecimal unrestrictedBudget,
      @Parameter(name = "tasOnlyBudget") @RequestParam(required = false) BigDecimal tasOnlyBudget,
      @Parameter(name = "ulasOnlyBudget") @RequestParam(required = false)
          BigDecimal ulasOnlyBudget) {
    requireNotNegative("unrestrictedBudget", unrestrictedBudget);
    requireNotNegative("tasOnlyBudget", tasOnlyBudget);
    requireNotNegative("ulasOnlyBudget", ulasOnlyBudget);

    Budget budget = budgetService.budgetFor(quarter);
    clientActivityDetector.note(resourceKey(quarter), clientId, identity());
    if (version != null && !version.equals(budget.getVersion())) {
      return conflict(quarter);
    }
    if (unrestrictedBudget != null) {
      budget.setUnrestrictedBudget(BudgetService.money(unrestrictedBudget));
    }
    if (tasOnlyBudget != null) {
      budget.setTasOnlyBudget(BudgetService.money(tasOnlyBudget));
    }
    if (ulasOnlyBudget != null) {
      budget.setUlasOnlyBudget(BudgetService.money(ulasOnlyBudget));
    }
    try {
      budgetRepository.save(budget);
    } catch (ObjectOptimisticLockingFailureException e) {
      // Another save got in between reading the budget and writing it.
      return conflict(quarter);
    }
    return ResponseEntity.ok(budgetService.summary(quarter));
  }

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
   * Who the current user is to the detector: the email address is the person, and the label other
   * people see is the email address followed by the full name in parentheses, if there is one.
   */
  private ClientIdentity identity() {
    User user = getCurrentUser().getUser();
    String name = user.getFullName();
    String label =
        name == null || name.isBlank()
            ? user.getEmail()
            : user.getEmail() + " (" + name.trim() + ")";
    return new ClientIdentity(user.getEmail(), label);
  }

  /** What a refused save tells the page: why, and the quarter as it now stands. */
  private ResponseEntity<Object> conflict(String quarter) {
    BudgetService.Summary current = budgetService.summary(quarter);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "This budget was changed in another tab or window. Use theirs, or overwrite with yours.");
    body.put("version", current.budget().getVersion());
    body.put("summary", current);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  private static void requireNotNegative(String name, BigDecimal amount) {
    if (amount != null && amount.signum() < 0) {
      throw new IllegalArgumentException("%s must not be negative".formatted(name));
    }
  }
}
