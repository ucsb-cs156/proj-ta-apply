package edu.ucsb.cs.taapply.controller;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackSettingsRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.BudgetCreationService;
import edu.ucsb.cs.taapply.services.BudgetService;
import edu.ucsb.cs.taapply.time.AppTime;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Instructors' feedback on the TA/ULA allocation of their courses (issue #425): the form in each
 * course's drop-down on the instructor home page.
 *
 * <p>Who may save is decided as the home page decides what to show: the caller's email maps to a
 * catalog name (issue #120), and the course must be a non-removed recruitment course whose
 * instructor of record is that name. The form opens, and saves are accepted, only once the
 * quarter's allocations are released: the allocations of every recruitment of the quarter that
 * holds a course the caller teaches (a TA-only quarter needs the TA allocations, a ULA-only quarter
 * the ULA ones, a quarter with both needs both).
 *
 * <p>Saves are refused, and the home page shows no form, while an admin has turned off "Ask faculty
 * for feedback" on the Instructor Feedback Settings page (issue #430). What was saved before is
 * kept, and reading it is never refused.
 *
 * <p>Each save changes only the fields present in its body, to absolute values, so saves of
 * different fields never overwrite each other. There is no version check and no multi-tab warning:
 * the row is one instructor's own, and the last save of a field wins.
 */
@Tag(name = "InstructorFeedback")
@RequestMapping("/api/instructor/feedback")
@RestController
public class InstructorFeedbackController extends ApiController {

  @Autowired InstructorFeedbackRepository instructorFeedbackRepository;
  @Autowired InstructorRepository instructorRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired BudgetRepository budgetRepository;
  @Autowired BudgetCreationService budgetCreationService;
  @Autowired InstructorFeedbackSettingsRepository instructorFeedbackSettingsRepository;

  /** Why a save is refused while the Instructor Feedback Settings do not ask for feedback. */
  static final String NOT_ASKING_MESSAGE =
      "Feedback on TA/ULA allocations is not being collected at this time: an admin has turned it"
          + " off on the Instructor Feedback Settings page.";

  /**
   * The two figures of the quarter's budget the "Notes on TA/ULA tradeoffs" need, and nothing else
   * of the budget: the estimated cost per TA and the estimated cost per ULA (the ULA hourly rate
   * times the hours per ULA). Each is null while not yet entered.
   */
  public static record TradeoffCosts(
      String quarter, BigDecimal estimatedCostPerTA, BigDecimal estimatedCostPerULA) {

    /**
     * The two figures of the quarter's budget, both null when it has none. Also the admin's preview
     * on the Instructor Feedback Settings page (issue #429), which reads without creating.
     */
    static TradeoffCosts of(String quarter, BudgetRepository budgets) {
      return budgets
          .findById(quarter)
          .map(
              budget ->
                  new TradeoffCosts(
                      quarter,
                      budget.getTaCostPerQuarter(),
                      BudgetService.estimatedCostPerUla(budget)))
          .orElse(new TradeoffCosts(quarter, null, null));
    }
  }

  @Operation(
      summary = "The signed-in instructor's allocation feedback",
      description = "Every row of the caller's own, in every quarter (issue #425).")
  @PreAuthorize("hasRole('ROLE_INSTRUCTOR')")
  @GetMapping("")
  public List<InstructorFeedback> mine() {
    return instructorFeedbackRepository.findByEmail(email());
  }

  @Operation(
      summary = "The estimated cost per TA and per ULA of a quarter, for the tradeoff notes",
      description =
          "Only for a quarter in which the caller teaches a course and whose allocations are"
              + " released (otherwise 403). A figure not yet entered is null.")
  @PreAuthorize("hasRole('ROLE_INSTRUCTOR')")
  @GetMapping("/costs")
  public TradeoffCosts costs(@Parameter(name = "quarter") @RequestParam String quarter) {
    requireReleased(quarter, recruitmentsOf(taught(email())).values());
    return TradeoffCosts.of(quarter, budgetRepository);
  }

  @Operation(
      summary = "Save some fields of the caller's feedback on a course",
      description =
          "Creates the row the first time. Only the fields present in the JSON body change:"
              + " allocReasonable, differentTACount, differentULACount and otherConcerns (true or"
              + " false), numTAsPreferred and numULAsPreferred (a whole number, 0 or more, or"
              + " null), comments (at most 2048 characters, or null). Sets lastUpdated and answers"
              + " with the row. 403 while the Instructor Feedback Settings do not ask for feedback,"
              + " and unless the caller teaches the course and the quarter's allocations are"
              + " released; 400 for a value out of range.")
  @PreAuthorize("hasRole('ROLE_INSTRUCTOR')")
  @PutMapping("")
  public InstructorFeedback save(
      @Parameter(name = "recruitmentCourseId") @RequestParam Long recruitmentCourseId,
      @RequestBody JsonNode body) {
    if (!InstructorFeedbackSettings.askingForFeedback(
        instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())) {
      throw new ForbiddenException(NOT_ASKING_MESSAGE);
    }
    String email = email();
    List<RecruitmentCourse> taught = taught(email);
    RecruitmentCourse course =
        taught.stream()
            .filter(row -> row.getId().equals(recruitmentCourseId))
            .findFirst()
            .orElseThrow(
                () ->
                    new ForbiddenException(
                        "This recruitment course is not assigned to the authenticated"
                            + " instructor."));
    Map<Long, Recruitment> recruitments = recruitmentsOf(taught);
    String quarter = recruitments.get(course.getRecruitmentId()).getQuarter();
    requireReleased(quarter, recruitments.values());

    InstructorFeedback feedback =
        instructorFeedbackRepository
            .findByQuarterAndEmailAndRecruitmentCourseId(quarter, email, recruitmentCourseId)
            .orElseGet(
                () ->
                    InstructorFeedback.builder()
                        .quarter(quarter)
                        .email(email)
                        .recruitmentCourseId(recruitmentCourseId)
                        .build());
    apply(feedback, body);
    // The row's parent; it exists once the quarter has a course, but make sure of it.
    budgetCreationService.findOrCreate(quarter);
    feedback.setLastUpdated(AppTime.now());
    return instructorFeedbackRepository.save(feedback);
  }

  /**
   * Sets the fields present in the body, after checking every one of them, so that a body with one
   * bad value changes nothing.
   */
  static void apply(InstructorFeedback feedback, JsonNode body) {
    if (body == null || !body.isObject()) {
      throw new IllegalArgumentException("The body must be a JSON object.");
    }
    Boolean allocReasonable = flag(body, "allocReasonable");
    Boolean differentTACount = flag(body, "differentTACount");
    Boolean differentULACount = flag(body, "differentULACount");
    Boolean otherConcerns = flag(body, "otherConcerns");
    Integer numTAsPreferred = count(body, "numTAsPreferred");
    Integer numULAsPreferred = count(body, "numULAsPreferred");
    String comments = comments(body);
    if (allocReasonable != null) {
      feedback.setAllocReasonable(allocReasonable);
    }
    if (differentTACount != null) {
      feedback.setDifferentTACount(differentTACount);
    }
    if (differentULACount != null) {
      feedback.setDifferentULACount(differentULACount);
    }
    if (otherConcerns != null) {
      feedback.setOtherConcerns(otherConcerns);
    }
    if (body.has("numTAsPreferred")) {
      feedback.setNumTAsPreferred(numTAsPreferred);
    }
    if (body.has("numULAsPreferred")) {
      feedback.setNumULAsPreferred(numULAsPreferred);
    }
    if (body.has("comments")) {
      feedback.setComments(comments);
    }
  }

  /** A checkbox's value: null when absent, else it must be true or false. */
  private static Boolean flag(JsonNode body, String field) {
    JsonNode value = body.get(field);
    if (value == null) {
      return null;
    }
    if (!value.isBoolean()) {
      throw new IllegalArgumentException(field + " must be true or false.");
    }
    return value.booleanValue();
  }

  /** A preferred count: null when absent or null, else a whole number, 0 or more. */
  private static Integer count(JsonNode body, String field) {
    JsonNode value = body.get(field);
    if (value == null || value.isNull()) {
      return null;
    }
    if (!value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() < 0) {
      throw new IllegalArgumentException(field + " must be a whole number, 0 or more, or null.");
    }
    return value.intValue();
  }

  /** The comments: null when absent or null, else text of at most 2048 characters. */
  private static String comments(JsonNode body) {
    JsonNode value = body.get("comments");
    if (value == null || value.isNull()) {
      return null;
    }
    if (!value.isTextual()) {
      throw new IllegalArgumentException("comments must be text or null.");
    }
    String text = value.textValue();
    if (text.length() > InstructorFeedback.MAX_COMMENTS) {
      throw new IllegalArgumentException(
          "comments may be at most " + InstructorFeedback.MAX_COMMENTS + " characters.");
    }
    return text;
  }

  /** The signed-in user's email. */
  private String email() {
    return getCurrentUser().getUser().getEmail();
  }

  /**
   * The non-removed recruitment courses whose instructor of record is the caller's catalog name:
   * the courses the home page shows them. None without a catalog name.
   */
  private List<RecruitmentCourse> taught(String email) {
    return instructorRepository
        .findByEmail(email)
        .map(Instructor::getCatalogName)
        .map(
            name ->
                recruitmentCourseRepository.findByInstructor(name).stream()
                    .filter(row -> !row.isRemoved())
                    .toList())
        .orElse(List.of());
  }

  /** The recruitments those courses are in, by id. */
  private Map<Long, Recruitment> recruitmentsOf(List<RecruitmentCourse> taught) {
    return StreamSupport.stream(
            recruitmentRepository
                .findAllById(
                    taught.stream()
                        .map(RecruitmentCourse::getRecruitmentId)
                        .collect(Collectors.toSet()))
                .spliterator(),
            false)
        .collect(Collectors.toMap(Recruitment::getId, Function.identity()));
  }

  /**
   * Throws unless the caller teaches in the quarter and every recruitment of the quarter they teach
   * in has released its allocations to faculty.
   */
  private static void requireReleased(String quarter, Collection<Recruitment> recruitments) {
    List<Recruitment> ofQuarter =
        recruitments.stream().filter(r -> quarter.equals(r.getQuarter())).toList();
    if (ofQuarter.isEmpty()) {
      throw new ForbiddenException("The authenticated instructor teaches no course in " + quarter);
    }
    if (!ofQuarter.stream().allMatch(InstructorRecruitmentsController::allocationsVisible)) {
      throw new ForbiddenException(
          "Feedback opens once the quarter's allocations have been released to faculty.");
    }
  }
}
