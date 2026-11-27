package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.FundingSource;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/** Issue #512, part 1: the Admin → Funding Sources page and its create and edit pages. */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class FundingSourcesWebIT extends WebTestCase {

  private static final String TABLE = "FundingSourcesIndexPage";
  private static final String FORM = "FundingSourceForm";

  @Test
  public void admin_creates_edits_and_deletes_a_funding_source_from_the_admin_menu()
      throws Exception {
    setupAdminUser();
    openPage(page, "/");

    page.getByTestId("appnavbar-admin-dropdown").click();
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Funding Sources")).click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).hasText("Funding Sources");
    assertThat(page.getByTestId(TABLE + "-note"))
        .containsText("An abbreviation cannot be changed once created");
    assertEquals(0, page.getByTestId(TABLE + "-cell-row-0-col-abbreviation").count());

    // Create: the form refuses a too-long abbreviation, then accepts NSF with the spaces trimmed.
    page.getByTestId(TABLE + "-create").click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).hasText("Create Funding Source");
    page.getByTestId(FORM + "-abbreviation").fill("abcdefghijk");
    page.getByTestId(FORM + "-explanation").fill("Eleven letters");
    page.getByTestId(FORM + "-submit").click();
    assertThat(page.getByText("Abbreviation is at most 10 characters.")).isVisible();
    assertEquals(0, fundingSourceRepository.count());

    page.getByTestId(FORM + "-abbreviation").fill("  NSF ");
    page.getByTestId(FORM + "-explanation").fill("National Science Foundation");
    page.getByTestId(FORM + "-submit").click();
    assertThat(page.getByText("New funding source created - abbreviation: NSF")).isVisible();
    assertThat(page.getByTestId(TABLE + "-cell-row-0-col-abbreviation")).hasText("NSF");
    assertThat(page.getByTestId(TABLE + "-cell-row-0-col-explanation"))
        .hasText("National Science Foundation");
    FundingSource stored = fundingSourceRepository.findById("NSF").orElseThrow();
    assertEquals("National Science Foundation", stored.getExplanation());

    // Edit: the abbreviation is shown but cannot be typed into; the explanation changes.
    page.getByTestId(TABLE + "-cell-row-0-col-edit-button").click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).hasText("Edit Funding Source");
    assertThat(page.getByTestId(FORM + "-abbreviation")).hasValue("NSF");
    assertThat(page.getByTestId(FORM + "-abbreviation")).hasAttribute("readonly", "");
    assertThat(page.getByTestId(FORM + "-abbreviation-note"))
        .containsText("The abbreviation cannot be changed.");
    page.getByTestId(FORM + "-explanation").fill("NSF grant");
    page.getByTestId(FORM + "-submit").click();
    assertThat(page.getByText("Funding source updated - abbreviation: NSF")).isVisible();
    assertThat(page.getByTestId(TABLE + "-cell-row-0-col-explanation")).hasText("NSF grant");
    assertEquals(
        "NSF grant", fundingSourceRepository.findById("NSF").orElseThrow().getExplanation());

    // Delete: no confirmation, a toast, and the row is gone.
    page.getByTestId(TABLE + "-cell-row-0-col-delete-button").click();
    assertThat(page.getByText("FundingSource with id NSF deleted")).isVisible();
    assertThat(page.getByTestId(TABLE + "-cell-row-0-col-abbreviation")).hasCount(0);
    assertFalse(fundingSourceRepository.existsById("NSF"));
  }

  /** Hiring staff may read the list through the API, but the admin pages are not theirs. */
  @Test
  public void hiring_staff_have_no_admin_menu_and_are_denied_the_funding_sources_page()
      throws Exception {
    fundingSourceRepository.save(
        FundingSource.builder()
            .abbreviation("NSF")
            .explanation("National Science Foundation")
            .build());
    setupHiringStaffUser();
    openPage(page, "/");

    assertThat(page.getByTestId("appnavbar-admin-dropdown")).hasCount(0);

    openPage(page, "/admin/fundingSources");
    assertThat(page.getByText("You do not have access to this page.")).isVisible();
    assertEquals(0, page.getByTestId(TABLE + "-cell-row-0-col-abbreviation").count());
  }
}
