package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microsoft.playwright.options.SelectOption;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
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
 * End-to-end coverage of the multi-tab warning and the version check on the admin Assignments page
 * (issue #280). The integration profile shortens the heartbeat to two seconds and the window to
 * six, so the warning can be watched appearing and going.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class AdminAssignmentsWebIT extends WebTestCase {

  @Autowired ApplicationRepository applicationRepository;

  private static final String BANNER = "AdminAssignmentsPage-multiple-tabs";
  private static final String SELECT = "AdminAssignmentsPage-table-cell-row-0-tentative-select";

  private void goTo(String path) {
    openPage(page, path);
  }

  private Recruitment seedRecruitment(String quarter, RecruitmentType type) {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter(quarter)
                .type(type)
                .applicationStatus(ApplicationStatus.CLOSED)
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.of(2026, 10, 1))
                .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   156")
            .section("0100")
            .enrollCode("07492")
            .title("ADV APP PROGRAM")
            .removed(false)
            .build());
    return recruitment;
  }

  private Application seedApplicant(Recruitment recruitment) {
    return applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email("grad@ucsb.edu")
            .firstName("Ada")
            .lastName("Lovelace")
            .build());
  }

  /** A second window of the same admin, on the same page. */
  private com.microsoft.playwright.BrowserContext openSecondWindow(
      com.microsoft.playwright.Page[] holder) {
    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    holder[0] = newPage(other);
    holder[0].navigate(page.url());
    awaitSettled(holder[0]);
    return other;
  }

  @Test
  public void a_second_window_on_the_same_recruitments_assignments_warns_and_asks_the_newer()
      throws Exception {
    Recruitment recruitment = seedRecruitment("20264", RecruitmentType.TA);
    setupAdminUser();
    goTo("/admin/recruitments/" + recruitment.getId() + "/assignments");
    assertThat(page.getByTestId("AdminAssignmentsPage-count")).isVisible();

    // Alone, there is nothing to warn about.
    assertThat(page.getByTestId(BANNER)).not().isVisible();

    com.microsoft.playwright.Page[] holder = new com.microsoft.playwright.Page[1];
    com.microsoft.playwright.BrowserContext other = openSecondWindow(holder);
    com.microsoft.playwright.Page otherPage = holder[0];

    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER))
        .containsText(
            "You are also editing this assignments page in another tab or window."
                + " We recommend that only one admin edits this page at a time.");
    // The newer window says who is "already" there, with the same closing sentence.
    assertThat(otherPage.getByTestId(BANNER))
        .containsText(
            "You already have this assignments page open for editing in another tab or window."
                + " We recommend that only one admin edits this page at a time.");
    // Only the newer window is asked what to do; the older one has the banner alone.
    assertThat(otherPage.getByTestId(BANNER + "-modal-leave")).isVisible();
    assertThat(page.getByTestId(BANNER + "-modal-leave")).not().isVisible();

    // Closing the newer window lets the warning go from the older one.
    other.close();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId(BANNER)).isHidden(gone);
  }

  @Test
  public void another_recruitments_assignments_never_warn() throws Exception {
    Recruitment first = seedRecruitment("20264", RecruitmentType.TA);
    Recruitment second = seedRecruitment("20264", RecruitmentType.ULA);
    setupAdminUser();
    goTo("/admin/recruitments/" + first.getId() + "/assignments");
    assertThat(page.getByTestId("AdminAssignmentsPage-count")).isVisible();

    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(
        page.url()
            .replaceAll(
                "(http://localhost:\\d+).*",
                "$1/admin/recruitments/" + second.getId() + "/assignments"));
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("AdminAssignmentsPage-count")).isVisible();

    // Wait out several heartbeats of both windows, then check neither was warned.
    page.waitForTimeout(6000);
    assertThat(page.getByTestId(BANNER)).not().isVisible();
    assertThat(otherPage.getByTestId(BANNER)).not().isVisible();
    other.close();
  }

  @Test
  public void a_move_from_a_page_that_has_gone_stale_is_refused_and_the_page_refreshed()
      throws Exception {
    Recruitment recruitment = seedRecruitment("20264", RecruitmentType.TA);
    Application applicant = seedApplicant(recruitment);
    setupAdminUser();
    goTo("/admin/recruitments/" + recruitment.getId() + "/assignments");
    assertThat(page.getByTestId(SELECT)).isVisible();

    // Something else changes the assignments (a publish, a cancellation, another tab).
    recruitmentRepository.bumpAssignmentsVersion(recruitment.getId());

    page.getByTestId(SELECT).selectOption(new SelectOption().setIndex(1));
    assertThat(
            page.getByText(
                "Assignments changed while you were working. The page has been refreshed;"
                    + " please check the placement and try again."))
        .isVisible();
    // Nothing was assigned, and the click was not replayed.
    assertNull(
        applicationRepository.findById(applicant.getId()).orElseThrow().getTentativeAssignmentId());

    // The page now carries the current version, so the same move goes through.
    page.getByTestId(SELECT).selectOption(new SelectOption().setIndex(1));
    assertThat(page.getByTestId("AdminAssignmentsPage-count")).containsText("1 assigned so far");
    assertNotNull(
        applicationRepository.findById(applicant.getId()).orElseThrow().getTentativeAssignmentId());
    assertEquals(
        3,
        recruitmentRepository.findById(recruitment.getId()).orElseThrow().getAssignmentsVersion());
  }

  @Test
  public void a_column_hidden_with_its_hide_link_stays_hidden_after_a_reload() throws Exception {
    Recruitment recruitment = seedRecruitment("20264", RecruitmentType.TA);
    seedApplicant(recruitment);
    setupAdminUser();
    goTo("/admin/recruitments/" + recruitment.getId() + "/assignments");
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-major")).isVisible();

    // Issue #355: the issue's wording, and the lecture named by its bare course number (no CMPSC,
    // no section when the recruitment has only one section of it) in the heading and the dropdown.
    assertThat(page.getByTestId("AdminAssignmentsPage-intro-purpose"))
        .hasText("On this page, the admin can assign TAs/ULA applicants to specific courses.");
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-group-0")).containsText("156");
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-group-0"))
        .not()
        .containsText("CMPSC");
    assertThat(page.getByTestId(SELECT).locator("option").nth(1)).hasText("156");

    // The small "hide" link over the Major heading, found by its accessible name.
    page.getByRole(
            com.microsoft.playwright.options.AriaRole.BUTTON,
            new com.microsoft.playwright.Page.GetByRoleOptions().setName("Hide Major column"))
        .click();
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-major")).not().isVisible();
    assertThat(page.getByTestId("AdminAssignmentsPage-columns-toggle")).containsText("1 hidden");

    // The choice is on the backend, so it survives a reload.
    reloadPage(page);
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-email")).isVisible();
    assertThat(page.getByTestId("AdminAssignmentsPage-table-header-major")).not().isVisible();
  }

  @Test
  public void the_admin_help_page_explains_simultaneous_editing() throws Exception {
    setupAdminUser();
    goTo("/help/admins");
    assertThat(page.getByTestId("HelpAdminsPage-simultaneous-editing"))
        .containsText("Simultaneous Editing");
    assertThat(page.getByTestId("HelpAdminsPage-simultaneous-editing-assignments-example"))
        .containsText(
            "phtcon@ucsb.edu (Phill Conrad) is also editing this assignments page."
                + " We recommend that only one admin edits this page at a time.");

    goTo("/help/developer");
    assertThat(page.getByTestId("HelpDeveloperPage-simultaneous-row-assignments"))
        .containsText("assignments:<recruitmentId>");
  }
}
