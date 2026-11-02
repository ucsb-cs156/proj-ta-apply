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
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
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
        browser.newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    holder[0] = other.newPage();
    holder[0].navigate(page.url());
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
                + " Please know that this is risky; we recommend closing all but one of these.");
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
        browser.newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = other.newPage();
    otherPage.navigate(
        page.url()
            .replaceAll(
                "(http://localhost:\\d+).*",
                "$1/admin/recruitments/" + second.getId() + "/assignments"));
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
  public void the_admin_help_page_explains_simultaneous_editing() throws Exception {
    setupAdminUser();
    goTo("/help/admins");
    assertThat(page.getByTestId("HelpAdminsPage-simultaneous-editing"))
        .containsText("Simultaneous Editing");
    assertThat(page.getByTestId("HelpAdminsPage-simultaneous-editing-example"))
        .containsText(
            "phtcon@ucsb.edu (Phill Conrad) is also editing this assignments page."
                + " Please know that this is risky; we recommend closing all but one of these.");

    goTo("/help/developer");
    assertThat(page.getByTestId("HelpDeveloperPage-simultaneous-row-assignments"))
        .containsText("assignments:<recruitmentId>");
  }
}
