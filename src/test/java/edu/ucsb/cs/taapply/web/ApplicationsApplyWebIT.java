package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Locator;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * End-to-end coverage of filling in and submitting the application form: the TA and ULA forms, the
 * recruitment cards on the home page, the prior coursework dialogs, and an admin's test
 * application. Shared setup is in {@link ApplicationsWebTestCase}.
 */
public class ApplicationsApplyWebIT extends ApplicationsWebTestCase {

  @Test
  public void a_regular_user_applies_and_the_application_is_listed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/");

    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    assertThat(page.getByTestId(card + "applied")).containsText("No application submitted yet");
    Locator applyLink = page.getByTestId(card + "apply");
    assertThat(applyLink).isVisible();
    applyLink.click();

    // A TA application asks the TA-only questions and none of the ULA ones.
    assertThat(page.getByTestId("ApplyPage-residencyStatus")).isVisible();
    assertThat(page.getByTestId("ApplyPage-videoLink")).not().isVisible();

    // With no earlier application to copy from, the names come from the Google account. The
    // OIDC token is the source of truth for profile fields, so these are its claims ("Test
    // User"), not whatever the test seeded into the User row.
    assertThat(page.getByTestId("ApplyPage-firstName")).hasValue("Test");
    assertThat(page.getByTestId("ApplyPage-lastName")).hasValue("User");

    // Every course in the recruitment is asked about, defaulting to not interested.
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-130A-NOT_INTERESTED")).isChecked();
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-NOT_INTERESTED")).isChecked();

    // A TA form asks about courses but not availability, and looks up no meeting times (#76).
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections")).not().isVisible();
    assertThat(page.getByTestId("ApplyPage-availableForLecturesFirstChoice")).not().isVisible();
    assertThat(page.getByTestId("ApplyPage-availabilityCommentsFirstChoice")).not().isVisible();

    fillAndSubmit();

    // Back on the home page, the card now says they have applied and offers the application.
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");
    assertThat(applyLink).not().isVisible();
    assertThat(page.getByTestId(card + "cancel")).containsText("Cancel my Application");

    // And it opens for editing, with the answers that were given.
    assertThat(page.getByTestId(card + "view")).containsText("View submitted application");
    page.getByTestId(card + "view").click();
    assertThat(page.getByTestId("ApplicationPage-status")).containsText("PENDING");
    assertThat(page.getByTestId("ApplicationPage-firstName")).hasValue("Chris");
    assertThat(page.getByTestId("ApplicationPage-major")).hasValue("Computer Science");
    assertThat(page.getByTestId("ApplicationPage-topic-Java-4")).isChecked();
    // The courses came back with the application, in order, with the school shown.
    assertThat(page.getByTestId("ApplicationPage-coursework-table-cell-row-2-col-school"))
        .containsText("De Anza College");
    // The version agreed to is shown back, already ticked.
    assertThat(page.getByTestId("ApplicationPage-notice-agree")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-notice-version")).containsText("Version 1");
    assertThat(page.getByTestId("ApplicationPage-firstChoiceCourse")).hasValue("CMPSC   156");
    // The first choice row says so instead of offering options; the other answer came back.
    assertThat(page.getByTestId("ApplicationPage-courseInterest-CMPSC-156-choice"))
        .containsText("1st choice");
    assertThat(page.getByTestId("ApplicationPage-courseInterest-CMPSC-130A-ENTHUSIASTIC"))
        .isChecked();

    page.getByTestId("ApplicationPage-lastName").fill("Gaucho-Smith");
    page.getByTestId("ApplicationPage-submit").click();

    reloadPage(page);
    assertThat(page.getByTestId("ApplicationPage-lastName")).hasValue("Gaucho-Smith");
  }

  /**
   * Issue #292: a first quarter grad student ticks the box under the GPA fields, which then need no
   * values; the application is stored without GPAs, and shows the box ticked when reopened.
   */
  @Test
  public void a_first_quarter_applicant_applies_without_gpas() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());

    assertThat(page.getByTestId("ApplyPage-firstQuarter")).not().isChecked();
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).isEnabled();
    page.getByTestId("ApplyPage-firstQuarter").check();
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).isDisabled();
    assertThat(page.getByTestId("ApplyPage-gpaOverall")).isDisabled();
    page.getByTestId("ApplyPage-firstQuarter").uncheck();
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).isEnabled();

    fillAndSubmit(true);

    // Stored with the flag and without GPAs, though some were typed before the box was ticked.
    assertThat(
            page.getByTestId(
                "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-applied"))
        .containsText("Application on File");
    Application stored = applicationRepository.findAll().iterator().next();
    assertTrue(stored.isFirstQuarter());
    assertNull(stored.getGpaMajor());
    assertNull(stored.getGpaOverall());

    // Reopened, the box is ticked and the GPA fields are disabled.
    page.getByTestId("HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-view")
        .click();
    assertThat(page.getByTestId("ApplicationPage-firstQuarter")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-gpaMajor")).isDisabled();
  }

  /** Any signed-in user sees every open recruitment, each labelled with its type. */
  @Test
  public void a_regular_user_sees_open_recruitments_of_both_types() throws Exception {
    Recruitment ta = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    Recruitment ula = seedRecruitment(RecruitmentType.ULA, LocalDate.now().plusDays(30));

    setupRegularUser();
    goTo("/");

    String cards = "HomePageLoggedIn-dashboard-current-card-";
    assertThat(page.getByTestId(cards + ta.getId() + "-type")).containsText("TA");
    assertThat(page.getByTestId(cards + ula.getId() + "-type")).containsText("ULA");
    assertThat(page.getByTestId(cards + ta.getId() + "-apply")).isVisible();
    assertThat(page.getByTestId(cards + ula.getId() + "-apply")).isVisible();
  }

  /** The ULA form rates topics on three levels and adds an Interests table rated 1 to 5. */
  @Test
  public void a_ula_application_asks_a_three_point_topic_scale_and_interests() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.ULA, LocalDate.now().plusDays(30));
    seedUlaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());

    // The topic table's headings are the worded three-point scale, and there is no 4 or 5.
    assertThat(page.getByTestId("ApplyPage-topicProficiencies")).containsText("1-Very comfortable");
    assertThat(page.getByTestId("ApplyPage-topicProficiencies")).containsText("3-Not familiar");
    assertThat(page.getByTestId("ApplyPage-topic-JavaScript-3")).isVisible();
    assertThat(page.getByTestId("ApplyPage-topic-JavaScript-4")).not().isVisible();
    // The interests table lists the admin's areas with a 1 to 5 scale.
    assertThat(page.getByTestId("ApplyPage-interests")).containsText("1-Not interested");
    assertThat(page.getByTestId("ApplyPage-interests")).containsText("5-Very interested");

    // Issue #140: the instructions for the teaching-demo video, under the video link box.
    assertThat(page.getByTestId("ApplyPage-videoLink-instructions"))
        .hasText("Instructions for preparing your video");
    assertThat(page.getByTestId("ApplyPage-videoLink-instructions"))
        .hasAttribute("target", "_blank");

    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-major").selectOption("Computer Science");
    page.getByTestId("ApplyPage-topic-JavaScript-2").check();
    page.getByTestId("ApplyPage-interest-Tutoring-5").check();
    page.getByTestId("ApplyPage-interest-Grading-1").check();

    // Choosing a course brings up when it meets, looked up live, between the dropdown and the
    // availability questions; it can be folded away. Only the ULA form asks about availability.
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections")).not().isVisible();
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    // Issue #148: a choice not listed as taken is flagged, with the explanation in a row under it.
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-untaken")).isVisible();
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-untaken-warning"))
        .containsText("Have you taken this course?");
    assertThat(page.getByTestId("ApplyPage-comments-untaken"))
        .containsText("You have listed CMPSC");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-title"))
        .containsText("ADV APP PROGRAM");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type"))
        .containsText("Lecture");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-time"))
        .containsText("14:00 - 15:15");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-2-section"))
        .containsText("0102");
    page.getByTestId("ApplyPage-firstChoiceSections-toggle").click();
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type")).not().isVisible();
    page.getByTestId("ApplyPage-firstChoiceSections-toggle").click();
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type")).isVisible();
    page.getByTestId("ApplyPage-availableForLecturesFirstChoice").check();
    page.getByTestId("ApplyPage-availabilityCommentsFirstChoice").fill("Free after 2pm.");
    addCourse("ApplyPage", "CMPSC 16");
    // Listing the chosen course as taken clears the flag and the explanation.
    addCourse("ApplyPage", "CMPSC 156");
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-untaken")).not().isVisible();
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-untaken-warning"))
        .not()
        .isVisible();
    assertThat(page.getByTestId("ApplyPage-comments-untaken")).not().isVisible();
    page.getByTestId("ApplyPage-notice-agree").check();

    // The questions from the ULA Google Form (issue #72). The perm number is required and
    // checked; the follow-up questions appear as the earlier answers call for them.
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-permNumber"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-permNumber").fill("12-4567");
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-permNumber"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-permNumber").fill("a1b2c3d");
    // Both GPAs, the year and the expected graduation are required of a ULA applicant (#78).
    page.getByTestId("ApplyPage-gpaMajor").fill("3.9");
    page.getByTestId("ApplyPage-gpaOverall").fill("3.8");
    page.getByTestId("ApplyPage-yearInProgram").fill("2nd");
    page.getByTestId("ApplyPage-graduationDate").fill("S27");
    assertThat(page.getByTestId("ApplyPage-studentStatusNextQuarter")).not().isVisible();
    page.getByTestId("ApplyPage-bsMsStudent").selectOption("true");
    page.getByTestId("ApplyPage-studentStatusNextQuarter").selectOption("GRADUATE");
    assertThat(page.getByTestId("ApplyPage-graduate-warning"))
        .containsText("strongly encouraged to apply to be a TA instead");
    page.getByTestId("ApplyPage-wantsTaEligibility").selectOption("true");
    page.getByTestId("ApplyPage-otherCampusJob").selectOption("NOT_SURE");
    assertThat(page.getByTestId("ApplyPage-employeeId")).not().isVisible();
    page.getByTestId("ApplyPage-priorUcsbEmployment").selectOption("true");
    page.getByTestId("ApplyPage-employeeId").fill("1234567");
    // The note's UCPath link opens in a new tab (issue #137).
    assertThat(page.getByTestId("ApplyPage-ucpath-link"))
        .hasAttribute("href", "https://www.ucpath.ucsb.edu/");
    assertThat(page.getByTestId("ApplyPage-ucpath-link")).hasAttribute("target", "_blank");
    // The I-9 agreement is its own section with a checkbox (issue #111).
    assertThat(page.getByTestId("ApplyPage-i9-link"))
        .hasAttribute("href", "https://www.uscis.gov/i-9-central/form-i-9-acceptable-documents");
    page.getByTestId("ApplyPage-i9Appointment").check();
    assertThat(page.getByTestId("ApplyPage-training")).not().isVisible();
    page.getByTestId("ApplyPage-previousServiceAsUla").fill("0");
    assertThat(page.getByTestId("ApplyPage-training-statement"))
        .containsText("five mandatory training sessions");
    // A first-time applicant must give a video link (issue #213).
    page.getByTestId("ApplyPage-videoLink").fill("https://example.edu/demo");
    page.getByTestId("ApplyPage-trainingCommitment").selectOption("UNSURE");
    page.getByTestId("ApplyPage-trainingCommitmentExplanation").fill("Might have a Friday lab");
    page.getByTestId("ApplyPage-changingMajor").selectOption("false");
    page.getByTestId("ApplyPage-submit").click();

    // Listed on the home page, and the answers come back when it is opened for editing.
    String ulaCard = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    assertThat(page.getByTestId(ulaCard + "applied")).containsText("Application on File");
    page.getByTestId(ulaCard + "view").click();
    assertThat(page.getByTestId("ApplicationPage-topic-JavaScript-2")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-interest-Tutoring-5")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-interest-Grading-1")).isChecked();
    // Stored upper case; the follow-ups come back with the answers that reveal them.
    assertThat(page.getByTestId("ApplicationPage-permNumber")).hasValue("A1B2C3D");
    assertThat(page.getByTestId("ApplicationPage-bsMsStudent")).hasValue("true");
    assertThat(page.getByTestId("ApplicationPage-studentStatusNextQuarter")).hasValue("GRADUATE");
    assertThat(page.getByTestId("ApplicationPage-graduate-warning")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-employeeId")).hasValue("1234567");
    assertThat(page.getByTestId("ApplicationPage-trainingCommitment")).hasValue("UNSURE");
    assertThat(page.getByTestId("ApplicationPage-trainingCommitmentExplanation"))
        .hasValue("Might have a Friday lab");
    assertThat(page.getByTestId("ApplicationPage-availableForLecturesFirstChoice")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-availabilityCommentsFirstChoice"))
        .hasValue("Free after 2pm.");
    // The stored choice's times come up again while editing.
    assertThat(page.getByTestId("ApplicationPage-firstChoiceSections-row-0-type"))
        .containsText("Lecture");
  }

  /**
   * Issue #309: filling a blank application top to bottom, Enter in a field and the course dialog's
   * buttons (and its Enter) must not submit the application or make the page jump to the first
   * missing answer; only the Submit Application button submits.
   */
  @Test
  public void enter_and_the_course_dialog_never_submit_the_application() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());

    // Top to bottom, pressing Enter in the text fields as an applicant might.
    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-firstName").press("Enter");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-lastName").press("Enter");
    page.getByTestId("ApplyPage-major").selectOption("Computer Science");
    page.getByTestId("ApplyPage-gpaMajor").fill("3.9");
    page.getByTestId("ApplyPage-gpaMajor").press("Enter");
    page.getByTestId("ApplyPage-gpaOverall").fill("3.8");
    page.getByTestId("ApplyPage-gpaOverall").press("Enter");
    page.getByTestId("ApplyPage-yearInProgram").fill("2nd");
    page.getByTestId("ApplyPage-yearInProgram").press("Enter");
    page.getByTestId("ApplyPage-graduationDate").fill("S27");
    page.getByTestId("ApplyPage-classLevel").selectOption("PHD");
    page.getByTestId("ApplyPage-residencyStatus").selectOption("US_CITIZEN");
    page.getByTestId("ApplyPage-languageExam").selectOption("EXEMPT_US_CITIZEN");
    page.getByTestId("ApplyPage-topic-Java-4").check();
    assertThat(page.getByTestId("ApplyPage-missing")).not().isVisible();
    assertEquals(0, applicationRepository.count());

    // The first choice course is deliberately still blank, as it is in the reported sequence.
    // Add a course with the dialog's button.
    page.getByTestId("ApplyPage-coursework-add-button").click();
    page.getByTestId("ApplyPage-coursework-modal-courseNumber").fill("CMPSC 130A");
    Object before = page.evaluate("window.scrollY");
    page.getByTestId("ApplyPage-coursework-modal-save").click();
    assertThat(page.getByTestId("ApplyPage-coursework-modal")).not().isVisible();
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("1 of at least 3");
    assertThat(page.getByTestId("ApplyPage-missing")).not().isVisible();
    assertEquals(before, page.evaluate("window.scrollY"));

    // Add another with Enter inside the dialog: that adds the course, not the application.
    page.getByTestId("ApplyPage-coursework-add-button").click();
    page.getByTestId("ApplyPage-coursework-modal-courseNumber").fill("CMPSC 130B");
    assertThat(page.getByTestId("ApplyPage-coursework-modal-courseNumber")).hasValue("CMPSC 130B");
    page.getByTestId("ApplyPage-coursework-modal-courseNumber").press("Enter");
    assertThat(page.getByTestId("ApplyPage-coursework-modal")).not().isVisible();
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("2 of at least 3");
    assertThat(page.getByTestId("ApplyPage-missing")).not().isVisible();
    assertEquals(before, page.evaluate("window.scrollY"));

    addCourse("ApplyPage", "CMPSC 156");
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("3 of at least 3");
    assertThat(page.getByTestId("ApplyPage-missing")).not().isVisible();
    assertEquals(0, applicationRepository.count());

    // Finish, with Enter pressed once more in the last text field; still nothing is submitted.
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    page.getByTestId("ApplyPage-notice-agree").check();
    page.getByTestId("ApplyPage-yearInProgram").press("Enter");
    assertEquals(0, applicationRepository.count());
    assertThat(page.getByTestId("ApplyPage-submit")).isVisible();

    // Only the explicit button submits.
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-submit")).not().isVisible();
    assertEquals(1, applicationRepository.count());
  }

  /** Issue #100: several UCSB courses can be added to the prior coursework table at once. */
  @Test
  public void several_ucsb_courses_can_be_added_to_prior_coursework_at_once() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    courseRepository.save(
        Course.builder().courseId("CMPSC    16").title("PROBLEM SOLVING I").build());
    courseRepository.save(Course.builder().courseId("CMPSC   130A").title("DATA STRUCT").build());
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").build());
    // Fall of last year is always among the ten years offered.
    String lastFall = (LocalDate.now().getYear() - 1) + "4";
    String lastFallLabel = "F" + String.valueOf(LocalDate.now().getYear() - 1).substring(2);

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());

    String bulk = "ApplyPage-coursework-bulk-";
    page.getByTestId("ApplyPage-coursework-bulk-button").click();
    assertThat(page.getByTestId(bulk + "row-CMPSC-16-title")).containsText("PROBLEM SOLVING I");
    // Nothing ticked yet, so nothing to add.
    assertThat(page.getByTestId(bulk + "add")).isDisabled();

    page.getByTestId(bulk + "row-CMPSC-16-taken").check();
    page.getByTestId(bulk + "row-CMPSC-16-term").selectOption(lastFall);
    page.getByTestId(bulk + "row-CMPSC-16-grade").selectOption("A");
    // Choosing a grade ticks the course too.
    page.getByTestId(bulk + "row-CMPSC-130A-grade").selectOption("IP");
    assertThat(page.getByTestId(bulk + "row-CMPSC-130A-taken")).isChecked();
    assertThat(page.getByTestId(bulk + "add")).containsText("Add 2 Courses");
    page.getByTestId(bulk + "add").click();

    // Both rows are in the table, as UCSB courses, with the title carried over.
    String table = "ApplyPage-coursework-table-cell-row-";
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("2 of at least 3");
    assertThat(page.getByTestId(table + "0-col-school")).containsText("UCSB");
    assertThat(page.getByTestId(table + "0-col-courseNumber")).containsText("CMPSC 16");
    assertThat(page.getByTestId(table + "0-col-courseTitle")).containsText("PROBLEM SOLVING I");
    assertThat(page.getByTestId(table + "0-col-term")).containsText(lastFallLabel);
    assertThat(page.getByTestId(table + "0-col-grade")).containsText("A");
    assertThat(page.getByTestId(table + "1-col-courseNumber")).containsText("CMPSC 130A");
    assertThat(page.getByTestId(table + "1-col-grade")).containsText("IP");
    assertThat(page.getByTestId(bulk + "button")).isVisible();
    assertThat(page.getByTestId("ApplyPage-coursework-bulk")).not().isVisible();
  }

  /** An admin previews the form for a recruitment; the result is flagged as a test. */
  @Test
  public void an_admin_can_enter_a_test_application_from_the_recruitments_table() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    // Closed: the preview has to work before applications open.
    recruitment.setApplicationStatus(ApplicationStatus.CLOSED);
    recruitmentRepository.save(recruitment);

    setupAdminUser();
    // Issue #234: the Test Application button is at the top of the Applications page.
    goTo("/admin/recruitments/" + recruitment.getId() + "/applications");
    page.getByTestId("RecruitmentApplicationsPage-header-test-application").click();

    // The warning sits above the form, and the form is the TA one.
    assertThat(page.getByTestId("TestOnlyBanner")).containsText("This is a test only");
    assertThat(page.getByTestId("TestApplicationPage-residencyStatus")).isVisible();
    assertThat(page.getByTestId("TestApplicationPage-saved")).not().isVisible();

    page.getByTestId("TestApplicationPage-firstName").fill("Ada");
    page.getByTestId("TestApplicationPage-lastName").fill("Admin");
    // Not on the list: Other, then the text.
    page.getByTestId("TestApplicationPage-major").selectOption("__OTHER__");
    page.getByTestId("TestApplicationPage-otherMajor").fill("Computer Science");
    // The TA answers required since issue #214; a passed exam asks when it was passed.
    page.getByTestId("TestApplicationPage-gpaMajor").fill("3.9");
    page.getByTestId("TestApplicationPage-gpaOverall").fill("3.8");
    page.getByTestId("TestApplicationPage-yearInProgram").fill("2nd");
    page.getByTestId("TestApplicationPage-graduationDate").fill("S27");
    page.getByTestId("TestApplicationPage-classLevel").selectOption("MS");
    page.getByTestId("TestApplicationPage-residencyStatus").selectOption("F1_STUDENT_VISA");
    page.getByTestId("TestApplicationPage-languageExam").selectOption("PASSED_F1_OR_J1_VISA");
    page.getByTestId("TestApplicationPage-languageExamDatePassed").fill("F25");
    page.getByTestId("TestApplicationPage-firstChoiceCourse").selectOption("CMPSC   156");
    addCourse("TestApplicationPage", "CMPSC 8");
    addCourse("TestApplicationPage", "CMPSC 16");
    addCourse("TestApplicationPage", "CMPSC 24");
    page.getByTestId("TestApplicationPage-submit").click();

    // Saved and shown back on the same page, still under the banner.
    assertThat(page.getByTestId("TestApplicationPage-saved")).isVisible();
    assertThat(page.getByTestId("TestApplicationPage-summary-Name")).containsText("Ada Admin");
    assertThat(page.getByTestId("TestOnlyBanner")).isVisible();
  }
}
