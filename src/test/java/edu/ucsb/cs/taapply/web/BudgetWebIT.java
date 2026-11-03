package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
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
        browser.newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = other.newPage();
    otherPage.navigate(page.url());
    assertThat(otherPage.getByTestId("BudgetPage-bottom-line")).isVisible();

    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER)).isVisible(wait);
    assertThat(page.getByTestId(BANNER))
        .containsText(
            "You are also editing this budget page in another tab or window. We recommend that only one admin");
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
        browser.newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = other.newPage();
    otherPage.navigate(page.url().replace("/F26", "/W27"));
    assertThat(otherPage.getByTestId("BudgetPage-bottom-line")).isVisible();

    // Long enough for several heartbeats of both, with the integration settings (2 seconds).
    page.waitForTimeout(7000);
    assertThat(page.getByTestId(BANNER)).not().isVisible();
    assertThat(otherPage.getByTestId(BANNER)).not().isVisible();
    other.close();
  }
}
