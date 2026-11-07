package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.BudgetCourse;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.BudgetCourseRepository;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
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
 * Issue #277: the Budget page warns when the same quarter is open twice, and asks the newer tab.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class BudgetWebIT extends WebTestCase {

  private static final String BANNER = "BudgetPage-multiple-tabs";

  @Autowired BudgetRepository budgetRepository;
  @Autowired BudgetCourseRepository budgetCourseRepository;

  /**
   * A recruitment with CMPSC 156 lecture 07492. The section's enrollment estimate is the quarter's,
   * one row in budget_courses shared by the two recruitments (issue #363), so it is created once.
   */
  private Recruitment recruitmentWithOneCourse(RecruitmentType type) {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20264")
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
    budgetRepository
        .findById("20264")
        .orElseGet(() -> budgetRepository.save(Budget.builder().quarter("20264").build()));
    budgetCourseRepository
        .findByQuarterAndEnrollCode("20264", "07492")
        .orElseGet(
            () ->
                budgetCourseRepository.save(
                    BudgetCourse.builder()
                        .quarter("20264")
                        .enrollCode("07492")
                        .courseId("CMPSC   156")
                        .section("0100")
                        .enrollmentEstimate(100)
                        .build()));
    return recruitment;
  }

  /** Issue #358: the Combined Allocation page, its conversion factor and an allocation edit. */
  @Test
  public void the_combined_allocation_page_saves_the_factor_and_an_allocation() throws Exception {
    Recruitment ta = recruitmentWithOneCourse(RecruitmentType.TA);
    recruitmentWithOneCourse(RecruitmentType.ULA);
    setupAdminUser();
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/allocations/F26"));

    // Both recruitments: one row for the shared section, the cost table and the default factor.
    assertThat(page.getByTestId("CombinedAllocationTable-header-aseRatio")).isVisible();
    assertThat(page.getByTestId("CombinedAllocationsPage-costs-ta")).containsText("Cost per TA");
    assertThat(page.getByTestId("CombinedAllocationsPage-conversionTAtoULA")).hasValue("3");
    assertThat(page.getByTestId("CombinedAllocationTable-row-0")).isVisible();
    assertThat(page.getByTestId("CombinedAllocationTable-row-1")).not().isVisible();

    // A factor that is not greater than zero is refused and nothing is saved.
    page.getByTestId("CombinedAllocationsPage-conversionTAtoULA").fill("0");
    assertThat(page.getByTestId("CombinedAllocationsPage-conversionTAtoULA-invalid"))
        .containsText("conversionTAtoULA must be greater than zero");

    // A valid one is saved as it is typed, and kept across a reload.
    page.getByTestId("CombinedAllocationsPage-conversionTAtoULA").fill("2");
    page.getByTestId("CombinedAllocationTable-cell-row-0-TA-allocation").fill("4");
    page.getByTestId("CombinedAllocationTable-cell-row-0-ULA-allocation").fill("2");
    page.waitForTimeout(1500);
    page.reload();
    assertThat(page.getByTestId("CombinedAllocationsPage-conversionTAtoULA")).hasValue("2");
    assertThat(page.getByTestId("CombinedAllocationTable-cell-row-0-TA-allocation")).hasValue("4");
    assertThat(page.getByTestId("CombinedAllocationTable-cell-row-0-ULA-allocation")).hasValue("2");
    // 4 + 2 / 2 = 5 TA-equivalents; 100 / 5
    assertThat(page.getByTestId("CombinedAllocationTable-cell-row-0-col-aseRatio")).hasText("1:20");

    // Section starts hidden; the Columns menu's Show All brings it (and the other columns) back.
    assertThat(page.getByTestId("CombinedAllocationTable-header-section")).not().isVisible();
    page.getByTestId("CombinedAllocationsPage-columns-toggle").click();
    page.getByTestId("CombinedAllocationsPage-columns-select-all").click();
    assertThat(page.getByTestId("CombinedAllocationTable-header-section")).isVisible();
    org.junit.jupiter.api.Assertions.assertEquals(
        2.0, budgetRepository.findById("20264").orElseThrow().getConversionTAtoULA());
    org.junit.jupiter.api.Assertions.assertEquals(
        4, recruitmentCourseRepository.findByRecruitmentId(ta.getId()).get(0).getAllocation());
  }

  /**
   * Issue #358 part 2: the Combined Allocation page heartbeats under each recruitment's Courses
   * edit page key, so it and a recruitment's edit page warn each other about the same allocations.
   */
  @Test
  public void the_combined_page_and_a_courses_edit_page_warn_each_other() throws Exception {
    Recruitment ta = recruitmentWithOneCourse(RecruitmentType.TA);
    recruitmentWithOneCourse(RecruitmentType.ULA);
    setupAdminUser();
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/allocations/F26"));
    assertThat(page.getByTestId("CombinedAllocationTable-row-0")).isVisible();
    assertThat(page.getByTestId("CombinedAllocationsPage-multiple-tabs")).not().isVisible();

    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    String editPage = "/admin/recruitments/" + ta.getId() + "/courses/edit";
    otherPage.navigate(page.url().replace("/admin/allocations/F26", editPage));
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-view-link")).isVisible();

    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("CombinedAllocationsPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("CombinedAllocationsPage-multiple-tabs"))
        .containsText(
            "You are also editing this quarter's allocations in another tab or window. We recommend"
                + " that only one admin");
    // The edit page came later, so it is the one asked; the combined page only shows the banner.
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs-modal-leave"))
        .isVisible();
    assertThat(page.getByTestId("CombinedAllocationsPage-multiple-tabs-modal-leave"))
        .not()
        .isVisible();

    // Closing the edit page lets the combined page's warning go.
    other.close();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId("CombinedAllocationsPage-multiple-tabs")).isHidden(gone);
  }

  @Test
  public void a_second_window_on_the_same_quarter_is_warned_and_asked_and_the_first_is_not_asked()
      throws Exception {
    recruitmentRepository.save(
        Recruitment.builder()
            .quarter("20264")
            .type(RecruitmentType.TA)
            .applicationStatus(ApplicationStatus.OPEN)
            .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
            .primaryConsiderationDate(LocalDate.of(2026, 10, 1))
            .actualOpeningDate(LocalDate.of(2026, 9, 1))
            .build());
    setupAdminUser();
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/budget/F26"));
    assertThat(page.getByTestId("BudgetPage-bottom-line")).isVisible();

    // Alone, there is nothing to warn about.
    assertThat(page.getByTestId(BANNER)).not().isVisible();

    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(page.url());
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("BudgetPage-bottom-line")).isVisible();

    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER))
        .containsText(
            "You are also editing this budget page in another tab or window. We recommend that only"
                + " one admin");
    // Only the newer window is asked what to do.
    assertThat(otherPage.getByTestId(BANNER + "-modal-leave")).isVisible();
    assertThat(page.getByTestId(BANNER + "-modal-leave")).not().isVisible();

    // Closing the second window lets the warning go.
    other.close();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId(BANNER)).isHidden(gone);
  }

  @Test
  public void a_different_quarter_never_warns() throws Exception {
    for (String quarter : new String[] {"20264", "20271"}) {
      recruitmentRepository.save(
          Recruitment.builder()
              .quarter(quarter)
              .type(RecruitmentType.TA)
              .applicationStatus(ApplicationStatus.OPEN)
              .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
              .primaryConsiderationDate(LocalDate.of(2026, 10, 1))
              .actualOpeningDate(LocalDate.of(2026, 9, 1))
              .build());
    }
    setupAdminUser();
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/budget/F26"));
    assertThat(page.getByTestId("BudgetPage-bottom-line")).isVisible();

    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(page.url().replace("/F26", "/W27"));
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("BudgetPage-bottom-line")).isVisible();

    // Long enough for several heartbeats of both, with the integration settings (2 seconds).
    page.waitForTimeout(7000);
    assertThat(page.getByTestId(BANNER)).not().isVisible();
    assertThat(otherPage.getByTestId(BANNER)).not().isVisible();
    other.close();
  }
}
