package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.FilePayload;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/** End-to-end coverage of the TA / ULA App Settings pages: one full CRUD round on a list. */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class AppSettingsWebIT extends WebTestCase {

  private void goTo(String path) {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  @Test
  public void admin_can_add_rename_and_remove_a_ta_major_from_the_admin_menu() throws Exception {
    setupAdminUser();
    goTo("/");

    // "Admin" also appears in the welcome text and the home page, so target the menu itself.
    page.getByTestId("appnavbar-admin-dropdown").click();
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("TA App Settings")).click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).containsText("TA App Settings");

    // Empty to start.
    assertThat(page.getByTestId("TaAppSettingsPage-majors-empty")).isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-topics-empty")).isVisible();

    // Create.
    page.getByTestId("TaAppSettingsPage-majors-add-input").fill("Computer Science");
    page.getByTestId("TaAppSettingsPage-majors-add-button").click();
    assertThat(page.getByTestId("TaAppSettingsPage-majors-table-cell-row-0-col-name"))
        .containsText("Computer Science");
    // The topics card is a separate list and is untouched.
    assertThat(page.getByTestId("TaAppSettingsPage-topics-empty")).isVisible();

    // Update.
    page.getByTestId("TaAppSettingsPage-majors-row-0-edit-button").click();
    page.getByTestId("TaAppSettingsPage-majors-row-0-edit-input").fill("Computer Engineering");
    page.getByTestId("TaAppSettingsPage-majors-row-0-save-button").click();
    assertThat(page.getByTestId("TaAppSettingsPage-majors-table-cell-row-0-col-name"))
        .containsText("Computer Engineering");

    // It survives a reload, so it really was stored.
    page.reload();
    assertThat(page.getByTestId("TaAppSettingsPage-majors-table-cell-row-0-col-name"))
        .containsText("Computer Engineering");

    // Delete.
    page.getByTestId("TaAppSettingsPage-majors-row-0-delete-button").click();
    assertThat(page.getByTestId("TaAppSettingsPage-majors-empty")).isVisible();
  }

  @Test
  public void ula_settings_page_is_separate_from_the_ta_one() throws Exception {
    setupAdminUser();
    goTo("/admin/settings/ta");
    page.getByTestId("TaAppSettingsPage-topics-add-input").fill("Compilers");
    page.getByTestId("TaAppSettingsPage-topics-add-button").click();
    assertThat(page.getByTestId("TaAppSettingsPage-topics-table-cell-row-0-col-name"))
        .containsText("Compilers");

    goTo("/admin/settings/ula");
    assertThat(page.getByRole(AriaRole.HEADING).first()).containsText("ULA App Settings");
    assertThat(page.getByTestId("UlaAppSettingsPage-topics-empty")).isVisible();
  }

  /** The CSV upload fills a list, and re-uploading the same file adds nothing. */
  @Test
  public void admin_can_fill_a_list_from_a_csv_and_reupload_safely() throws Exception {
    setupAdminUser();
    goTo("/admin/settings/ta");

    assertThat(page.getByTestId("TaAppSettingsPage-topics-csv-download-link"))
        .hasAttribute("href", "/api/admin/settings/ta-topics/csv");
    assertThat(page.getByTestId("TaAppSettingsPage-topics-csv-help-link"))
        .hasAttribute("href", "/help/csv#settings-lists");

    FilePayload csv =
        new FilePayload(
            "topics.csv",
            "text/csv",
            "\"name\"\n\"Java\"\n\"Python\"\n".getBytes(StandardCharsets.UTF_8));

    page.getByTestId("TaAppSettingsPage-topics-csv-upload-input").setInputFiles(csv);
    page.getByTestId("TaAppSettingsPage-topics-csv-upload-button").click();
    assertThat(page.getByText("Upload complete: 2 added, 0 already present")).isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-topics-table-cell-row-0-col-name"))
        .containsText("Java");
    assertThat(page.getByTestId("TaAppSettingsPage-topics-table-cell-row-1-col-name"))
        .containsText("Python");

    page.getByTestId("TaAppSettingsPage-topics-csv-upload-input").setInputFiles(csv);
    page.getByTestId("TaAppSettingsPage-topics-csv-upload-button").click();
    assertThat(page.getByText("Upload complete: 0 added, 2 already present")).isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-topics-table-cell-row-2-col-name"))
        .not()
        .isVisible();

    // The majors list is untouched.
    assertThat(page.getByTestId("TaAppSettingsPage-majors-empty")).isVisible();
  }

  /** Saving the notice appends a version; the editor is CodeMirror, so it is driven by keyboard. */
  @Test
  public void admin_can_save_a_new_version_of_the_notices() throws Exception {
    setupAdminUser();
    goTo("/admin/settings/ula");

    assertThat(page.getByTestId("UlaAppSettingsPage-notices-current"))
        .containsText("No version saved yet");
    assertThat(page.getByTestId("UlaAppSettingsPage-notices-save-button")).isDisabled();

    page.getByTestId("UlaAppSettingsPage-notices-editor").locator(".CodeMirror").click();
    page.keyboard().type("# ULA Terms");
    assertThat(page.getByTestId("UlaAppSettingsPage-notices-preview").locator("h1"))
        .containsText("ULA Terms");
    page.getByTestId("UlaAppSettingsPage-notices-save-button").click();

    assertThat(page.getByText("Saved version 1 of the ULA notices")).isVisible();
    assertThat(page.getByTestId("UlaAppSettingsPage-notices-current"))
        .containsText("Current: Version 1");
    assertThat(page.getByTestId("UlaAppSettingsPage-notices-history-row-0")).containsText("1");
    // Unchanged text cannot be saved again as a new version.
    assertThat(page.getByTestId("UlaAppSettingsPage-notices-save-button")).isDisabled();
  }

  @Test
  public void non_admins_are_denied_the_settings_pages() throws Exception {
    setupGradStudentUser();
    goTo("/admin/settings/ta");
    assertThat(page.getByText("TA App Settings")).not().isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-majors")).not().isVisible();
  }
}
