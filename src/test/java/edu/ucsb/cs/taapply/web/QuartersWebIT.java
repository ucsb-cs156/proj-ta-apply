package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/** Issue #151: the admin's Quarters page fills itself from the UCSB quarter calendar. */
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class QuartersWebIT extends WebTestCase {

  @Autowired UCSBAPIQuarterRepository ucsbApiQuarterRepository;

  private void goToQuarters() {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/quarters"));
  }

  @Test
  public void opening_the_page_saves_the_current_range_and_lists_it_newest_first()
      throws Exception {
    ucsbApiQuarterRepository.deleteAll();
    setupAdminUser();
    goToQuarters();

    // Nothing on file, Spring 2021 is current: 20212 through 20214 are fetched and saved.
    assertThat(page.getByTestId("QuartersPage-summary"))
        .hasText("Checked UCSB for quarters S21 through F21; 3 saved.");
    assertThat(page.getByTestId("QuartersPage-card-20214-qyy")).hasText("F21");
    assertThat(page.getByTestId("QuartersPage-card-20214-name")).hasText("FALL 2021");
    assertThat(page.getByTestId("QuartersPage-card-20214-firstDayOfClasses")).hasText("2021-10-01");
    assertThat(page.getByTestId("QuartersPage-card-20212-pass1Begin")).hasText("2020-12-28 09:00");
    assertThat(page.getByTestId("QuartersPage-card-20213-firstDayOfClasses")).hasText("");
    // Newest first by default; oldest first on request.
    assertThat(page.getByTestId("QuartersPage").locator("[data-testid$='-qyy']").first())
        .hasText("F21");
    page.getByTestId("QuartersPage-direction").selectOption("asc");
    assertThat(page.getByTestId("QuartersPage").locator("[data-testid$='-qyy']").first())
        .hasText("S21");
    assertThat(page.getByTestId("QuartersPage-card-20211-card")).not().isVisible();
  }

  @Test
  public void non_admin_is_denied_the_quarters_page() throws Exception {
    setupRegularUser();
    goToQuarters();

    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }
}
