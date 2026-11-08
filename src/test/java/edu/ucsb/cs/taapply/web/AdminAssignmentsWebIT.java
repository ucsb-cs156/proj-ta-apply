package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Locator;
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
import java.util.regex.Pattern;
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
  private static final String THERMOMETER = "AdminAssignmentsPage-progress";

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

    // Issue #315: the progress thermometer under the heading, against the default hiring target of
    // 1, before anything is assigned.
    assertThat(page.getByTestId(THERMOMETER + "-text")).hasText("Assignments made: 0 of 1 (0%)");
    assertThat(page.getByTestId(THERMOMETER + "-bar")).hasAttribute("role", "progressbar");
    assertThat(page.getByTestId(THERMOMETER + "-bar")).hasAttribute("aria-valuenow", "0");

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
    // The thermometer follows: the one assignment meets the target of 1, so the bar is full.
    assertThat(page.getByTestId(THERMOMETER + "-text")).hasText("Assignments made: 1 of 1 (100%)");
    assertThat(page.getByTestId(THERMOMETER + "-bar")).hasAttribute("aria-valuenow", "100");
    assertThat(page.getByTestId(THERMOMETER + "-fill")).hasClass(Pattern.compile("bg-success"));
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

  /**
   * Issue #415: every lecture column is 100px wide, the third count line reads "To Assign", a
   * cell's colour is a class rather than an inline style, and once a lecture is chosen for a row,
   * that row's cell for it has a thick black outline. The widths and the border are measured in the
   * browser, which also shows that index.css defines the classes. With two sections of CMPSC 156
   * the headings carry the longest kind of name, "156 (0100)" (12 characters), which must fit.
   */
  @Test
  public void lecture_columns_are_100px_wide_and_the_chosen_lecture_cell_is_outlined()
      throws Exception {
    Recruitment recruitment = seedRecruitment("20264", RecruitmentType.TA);
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   156")
            .section("0200")
            .enrollCode("07493")
            .title("ADV APP PROGRAM")
            .removed(false)
            .build());
    seedApplicant(recruitment);
    setupAdminUser();
    goTo("/admin/recruitments/" + recruitment.getId() + "/assignments");
    assertThat(page.getByTestId(SELECT)).isVisible();

    // The first lecture's heading (the th; its sort header and carets share the prefix).
    Locator heading =
        page.locator("[data-testid^='AdminAssignmentsPage-table-header-course-']").first();
    assertThat(heading).hasClass(Pattern.compile("course-column"));
    assertThat(heading).containsText("156   (0100)");
    assertThat(heading).containsText("To Assign");
    assertThat(heading).not().containsText("Left");
    double headingWidth = heading.boundingBox().width;
    assertTrue(Math.abs(headingWidth - 100) <= 1.5, "heading width was " + headingWidth);
    // The 12-character name fits on one line of the 100px column, with room to spare.
    Locator label =
        page.locator("[data-testid^='AdminAssignmentsPage-table-course-'][data-testid$='-label']")
            .first();
    assertThat(label).hasText("156   (0100)");
    assertEquals(true, label.evaluate("e => e.scrollWidth <= e.closest('th').clientWidth"));
    assertEquals(
        true,
        label.evaluate(
            "e => e.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(e).fontSize)"));
    // The count lines are smaller than the name.
    Locator toAssign =
        page.locator("[data-testid^='AdminAssignmentsPage-table-course-'][data-testid$='-left']")
            .first();
    assertThat(toAssign).hasClass(Pattern.compile("course-heading-count"));
    assertEquals("12px", toAssign.evaluate("e => getComputedStyle(e).fontSize"));

    // The applicant marked no interest: the cell is pale red by its class, with no inline style,
    // and not outlined.
    Locator cell =
        page.locator("[data-testid^='AdminAssignmentsPage-table-cell-row-0-course-']").first();
    assertThat(cell).hasClass(Pattern.compile("candidate-course-rank-not-applicable"));
    assertThat(cell).not().hasClass(Pattern.compile("selected-course-assignment-cell"));
    assertNull(cell.getAttribute("style"));
    assertEquals("rgb(248, 215, 218)", cell.evaluate("e => getComputedStyle(e).backgroundColor"));
    assertEquals("0px", cell.evaluate("e => getComputedStyle(e).borderTopWidth"));
    Locator td =
        page.locator("[data-testid^='AdminAssignmentsPage-table-cell-row-0-col-course-']").first();
    assertThat(td).hasClass(Pattern.compile("course-column"));
    double tdWidth = td.boundingBox().width;
    assertTrue(Math.abs(tdWidth - 100) <= 1.5, "cell width was " + tdWidth);

    // Choosing the first lecture outlines that cell, and the counts follow.
    page.getByTestId(SELECT).selectOption(new SelectOption().setIndex(1));
    assertThat(cell).hasClass(Pattern.compile("selected-course-assignment-cell"));
    assertEquals("5px solid rgb(0, 0, 0)", cell.evaluate("e => getComputedStyle(e).borderTop"));
    assertThat(heading).containsText("Assigned 1");
    assertThat(cell).hasClass(Pattern.compile("candidate-course-rank-not-applicable"));
    // The other lecture's cell is not outlined, and the column is still 100px.
    Locator otherCell =
        page.locator("[data-testid^='AdminAssignmentsPage-table-cell-row-0-col-course-']")
            .nth(1)
            .locator(":scope > div");
    assertThat(otherCell).not().hasClass(Pattern.compile("selected-course-assignment-cell"));
    headingWidth = heading.boundingBox().width;
    assertTrue(Math.abs(headingWidth - 100) <= 1.5, "heading width was " + headingWidth);

    // Clearing the dropdown takes the outline away again.
    page.getByTestId(SELECT).selectOption(new SelectOption().setIndex(0));
    assertThat(cell).not().hasClass(Pattern.compile("selected-course-assignment-cell"));
    assertThat(heading).containsText("Assigned 0");
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
