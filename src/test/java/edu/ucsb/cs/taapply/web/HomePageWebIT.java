package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/**
 * Verifies that a logged-in user sees the home page, and that it reflects the roles they actually
 * hold.
 *
 * <p>Prerequisites: the frontend must be built ({@code npm run build} inside {@code frontend/}) so
 * that {@code target/classes/public/index.html} exists. Run with:
 *
 * <pre>
 * INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify
 * </pre>
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class HomePageWebIT extends WebTestCase {

  @Autowired CatalogNameRepository catalogNameRepository;
  @Autowired InstructorRepository instructors;
  @Autowired AdminRepository admins;
  @Autowired BudgetRepository budgets;

  @Test
  public void logged_in_regular_user_sees_only_the_student_section() throws Exception {
    setupRegularUser();

    // Everyone signed in is a student as far as applying goes (issue #107); only that section,
    // and with no other section to tell it from, no Student heading either (issue #118).
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-greeting")).hasCount(0);
    assertThat(page.locator("h1")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications are not currently being accepted.");
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_admin_sees_the_admin_section_and_the_student_one() throws Exception {
    setupAdminUser();

    assertThat(page.getByTestId("HomePageLoggedIn-admin")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).containsText("Admin");
    // The recruitments table, empty here: just its headings.
    // Issue #141: the whole recruitments dashboard, create button and all.
    assertThat(page.getByTestId("HomePageLoggedIn-admin-heading")).hasText("Recruitments");
    assertThat(page.getByTestId("HomePageLoggedIn-admin-create-button")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasText("Student");
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_instructor_sees_the_instructor_section_and_the_student_one()
      throws Exception {
    setupInstructorUser();

    // No catalog name yet, so nothing to list (issue #127).
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none"))
        .containsText("No recruitment includes a course you are listed as teaching.");
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
  }

  /**
   * Issue #127: once an admin has assigned the catalog name, the instructor's courses show. Since
   * issue #364 the card is the quarter's, and the course holds a TA card with the recruitment's
   * status.
   */
  @Test
  public void an_instructor_with_a_catalog_name_sees_a_card_per_quarter_with_their_courses()
      throws Exception {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.OPEN)
                .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
                .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
                .actualOpeningDate(LocalDate.of(2026, 1, 6))
                .build());
    RecruitmentCourse mine =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .enrollCode("07492")
                .section("0100")
                .title("ADV APP PROGRAM")
                .instructor("CONRAD P")
                .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   130A")
            .enrollCode("07600")
            .section("0100")
            .title("DATA STRUCT")
            .instructor("SOMEONE ELSE")
            .build());
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());

    setupInstructorUser();
    // setupInstructorUser inserts the instructor row without a catalog name; assign one now.
    instructors.save(
        Instructor.builder().email("instructor@ucsb.edu").catalogName("CONRAD P").build());
    reloadPage(page);

    // Issue #364: the card is the quarter's, and its header is the quarter alone.
    String card = "HomePageLoggedIn-instructor-recruitments-quarter-20261";
    assertThat(page.getByTestId(card + "-quarter")).hasText("W26");
    // The quarter card's own header (the nested TA card has one too).
    assertThat(page.getByTestId(card + "-card").locator(":scope > .card-header")).hasText("W26");
    String course = card + "-course-" + mine.getId();
    String header = course + "-header";
    assertThat(page.getByTestId(header)).containsText("CMPSC   156");
    assertThat(page.getByTestId(header)).containsText("(0100) ADV APP PROGRAM");
    // Only the instructor's own course, not the colleague's.
    assertThat(page.getByTestId(card + "-courses")).not().containsText("130A");
    assertThat(page.getByTestId(card + "-courses").locator(".accordion-item")).hasCount(1);

    page.getByTestId(header).getByRole(com.microsoft.playwright.options.AriaRole.BUTTON).click();
    // Nothing released (issue #410): all six columns; Enrollment Estimate and TA Allocation read
    // TBD (the TA recruitment has not released) and ULA Allocation N/A (there is no ULA
    // recruitment), then the feedback area, which waits for the TA allocations (issue #425).
    assertThat(page.getByTestId(course + "-enrollment").locator("thead th")).hasCount(6);
    assertThat(page.getByTestId(course + "-section")).hasText("0100");
    assertThat(page.getByTestId(course + "-enrollment-estimate")).hasText("TBD");
    assertThat(page.getByTestId(course + "-ta-allocation")).hasText("TBD");
    assertThat(page.getByTestId(course + "-ula-allocation")).hasText("N/A");
    assertThat(page.getByTestId(course + "-feedback-waiting"))
        .hasText(
            "When initial TA allocations have been released to faculty, you will be given an"
                + " opportunity here to provide feedback");
    assertThat(page.getByTestId(course + "-feedback-form")).hasCount(0);
    // The TA card carries the recruitment's status and, since issue #410, only the faculty review
    // dates: the application dates are not on it. There is no ULA recruitment, so no ULA card.
    assertThat(page.getByTestId(course + "-TA-type")).hasText("TA");
    assertThat(page.getByTestId(course + "-TA-applicationStatus")).containsText("OPEN");
    assertThat(page.getByTestId(course + "-TA-tentativeOpeningDate")).hasCount(0);
    assertThat(page.getByTestId(course + "-TA-card")).not().containsText("2026-01-05");
    assertThat(page.getByTestId(course + "-TA-card")).containsText("Faculty Reviews Opened:");
    assertThat(page.getByTestId(course + "-TA-card")).containsText("Faculty Ranking Deadline:");
    assertThat(page.getByTestId(course + "-ULA-card")).hasCount(0);
    // Reviews have not started, so no ranking action is offered yet; and no Courses button.
    assertThat(page.getByTestId(course + "-TA-not-open"))
        .containsText("Candidate rankings will be available when faculty reviews open.");
    assertThat(
            page.getByTestId(course + "-body")
                .getByRole(
                    com.microsoft.playwright.options.AriaRole.LINK,
                    new com.microsoft.playwright.Locator.GetByRoleOptions().setName("Courses")))
        .hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none")).not().isVisible();
  }

  /**
   * Issue #425: the course waits for the allocations; once the admin releases them the feedback
   * form appears, and what the instructor checks and types is saved as they go and is still there
   * after a reload, with when it was last saved.
   */
  @Test
  public void an_instructor_gives_feedback_once_the_allocations_are_released() throws Exception {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.CLOSED)
                .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
                .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
                .build());
    RecruitmentCourse mine =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .enrollCode("07492")
                .section("0100")
                .title("ADV APP PROGRAM")
                .instructor("CONRAD P")
                .allocation(2)
                .build());
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());
    setupInstructorUser();
    instructors.save(
        Instructor.builder().email("instructor@ucsb.edu").catalogName("CONRAD P").build());
    reloadPage(page);

    String course = "HomePageLoggedIn-instructor-recruitments-quarter-20261-course-" + mine.getId();
    String form = course + "-feedback";
    page.getByTestId(course + "-header")
        .getByRole(com.microsoft.playwright.options.AriaRole.BUTTON)
        .click();
    // Before the release: the waiting message, no form.
    assertThat(page.getByTestId(form + "-waiting"))
        .containsText("When initial TA allocations have been released to faculty");
    assertThat(page.getByTestId(form + "-form")).hasCount(0);

    // The admin releases the TA allocations.
    recruitment.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    recruitmentRepository.save(recruitment);
    reloadPage(page);
    page.getByTestId(course + "-header")
        .getByRole(com.microsoft.playwright.options.AriaRole.BUTTON)
        .click();

    assertThat(page.getByTestId(form + "-form")).isVisible();
    assertThat(page.getByTestId(form + "-waiting")).hasCount(0);
    assertThat(page.getByTestId(form + "-last-saved")).hasText("Last saved: never");
    assertThat(page.getByTestId(form + "-at-least-one")).isVisible();
    // A TA-only quarter: no ULA line.
    assertThat(page.getByTestId(form + "-differentULACount-line")).hasCount(0);

    page.getByTestId(form + "-differentTACount").check();
    // The saves go one after another, so once the comments' save is answered all of them are.
    page.waitForResponse(
        response ->
            response.request().method().equals("PUT")
                && response.url().contains("/api/instructor/feedback")
                && response.request().postData().contains("fourth lab"),
        () -> {
          page.getByTestId(form + "-numTAsPreferred").fill("3");
          page.getByTestId(form + "-comments").fill("One more TA would let us open a fourth lab.");
          page.getByTestId(form + "-comments").blur();
        });
    assertThat(page.getByTestId(form + "-last-saved")).not().hasText("Last saved: never");
    assertThat(page.getByTestId(form + "-at-least-one")).hasCount(0);

    reloadPage(page);
    page.getByTestId(course + "-header")
        .getByRole(com.microsoft.playwright.options.AriaRole.BUTTON)
        .click();
    assertThat(page.getByTestId(form + "-differentTACount")).isChecked();
    assertThat(page.getByTestId(form + "-allocReasonable")).not().isChecked();
    assertThat(page.getByTestId(form + "-numTAsPreferred")).hasValue("3");
    assertThat(page.getByTestId(form + "-comments"))
        .hasValue("One more TA would let us open a fourth lab.");
    assertThat(page.getByTestId(form + "-last-saved")).containsText("Last saved: ");
    assertThat(page.getByTestId(form + "-last-saved")).not().hasText("Last saved: never");
    // The tradeoff notes are there, closed.
    assertThat(page.getByTestId(form + "-notes-summary")).hasText("Notes on TA/ULA tradeoffs");
    assertThat(page.getByTestId(form + "-notes-text")).not().isVisible();
  }

  /**
   * Issue #429: an admin saves a new version of the notes on Instructor Feedback Settings, and an
   * instructor whose quarter is released opens the notes and sees it, with the quarter and its
   * costs filled in. One user is both, so the browser need not sign in twice.
   */
  @Test
  public void an_admin_edits_the_tradeoff_notes_and_an_instructor_sees_them() throws Exception {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.CLOSED)
                .allocationVisibility(AllocationVisibility.OWN_COURSES)
                .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
                .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
                .build());
    RecruitmentCourse mine =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .enrollCode("07492")
                .section("0100")
                .title("ADV APP PROGRAM")
                .instructor("CONRAD P")
                .allocation(2)
                .build());
    Budget budget =
        budgets.findById("20261").orElseGet(() -> Budget.builder().quarter("20261").build());
    budget.setTaCostPerQuarter(new BigDecimal("12000.00"));
    budget.setUlaRateDollarsPerHour(new BigDecimal("20.00"));
    budget.setEstimatedHoursPerULAPerQuarter(new BigDecimal("100.00"));
    budgets.save(budget);
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());
    setupInstructorUser();
    instructors.save(
        Instructor.builder().email("instructor@ucsb.edu").catalogName("CONRAD P").build());
    admins.save(Admin.builder().email("instructor@ucsb.edu").build());

    // The admin's page starts with the version the app was installed with.
    openPage(page, "/admin/instructorFeedbackSettings");
    String card = "InstructorFeedbackSettingsPage-notes";
    assertThat(page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setLevel(1)))
        .hasText("Instructor Feedback Settings");
    assertThat(page.getByTestId(card + "-history-row-0")).containsText("(installed with the app)");
    assertThat(page.getByTestId(card + "-current")).containsText("Current: Version 1");
    assertThat(page.getByTestId(card + "-preview"))
        .containsText("Note that the current estimated cost of a TA is $12,000.00");

    // The editor is CodeMirror, so it is driven by keyboard.
    page.getByTestId(card + "-editor").locator(".CodeMirror").click();
    page.keyboard().press("ControlOrMeta+A");
    page.keyboard().press("Delete");
    page.keyboard().type("A TA costs ${estimatedCostPerTA} (${taToUlaCostRatio}) in ${quarter}.");
    assertThat(page.getByTestId(card + "-preview"))
        .hasText("A TA costs $12,000.00 (1:6.0) in Winter 2026.");
    page.getByTestId(card + "-save-button").click();

    assertThat(page.getByText("Saved version 2 of the notes on TA/ULA tradeoffs")).isVisible();
    assertThat(page.getByTestId(card + "-current")).containsText("Current: Version 2");
    assertThat(page.getByTestId(card + "-history-row-0")).containsText("instructor@ucsb.edu");
    assertThat(page.getByTestId(card + "-history-row-1")).containsText("(installed with the app)");

    // The instructor opens the course and its notes.
    openPage(page, "/");
    String course = "HomePageLoggedIn-instructor-recruitments-quarter-20261-course-" + mine.getId();
    String form = course + "-feedback";
    page.getByTestId(course + "-header").getByRole(AriaRole.BUTTON).click();
    page.getByTestId(form + "-notes-summary").click();
    assertThat(page.getByTestId(form + "-notes-text"))
        .hasText("A TA costs $12,000.00 (1:6.0) in Winter 2026.");
  }
}
