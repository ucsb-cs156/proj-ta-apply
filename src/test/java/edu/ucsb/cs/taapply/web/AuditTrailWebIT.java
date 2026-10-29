package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
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
 * The Audit Trail page, reached from the Admin menu, against rows seeded straight into the table.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class AuditTrailWebIT extends WebTestCase {

  @Autowired AuditTrailRepository auditTrailRepository;

  private void goTo(String path) {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  @Test
  public void an_admin_sees_the_trail_newest_first_and_can_open_a_long_value() throws Exception {
    auditTrailRepository.save(
        AuditTrail.builder()
            .taApplicationId(7L)
            .fieldName("major")
            .oldValue("Computer Science")
            .newValue("Computer Engineering")
            .build());
    auditTrailRepository.save(
        AuditTrail.builder()
            .ulaApplicationId(9L)
            .fieldName("comments")
            .oldValue("Happy to help with either lecture, whichever needs it most.")
            .newValue(null)
            .build());

    setupAdminUser();
    goTo("/");
    page.getByText("Admin").first().click();
    page.getByText("Audit Trail").click();

    assertThat(page.getByTestId("AuditTrailPage-total")).containsText("2 changes recorded.");
    // Newest first: the comments change, with its long old value cut short.
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-0-col-fieldName"))
        .containsText("comments");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-0-col-ulaApplicationId"))
        .containsText("9");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-0-col-oldValue"))
        .containsText("Happy to help w... [See value]");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-1-col-fieldName"))
        .containsText("major");

    page.getByTestId("AuditTrailPage-table-cell-row-0-col-oldValue-see").click();
    assertThat(page.getByTestId("AuditTrailPage-table-value-modal-body"))
        .containsText("Happy to help with either lecture, whichever needs it most.");
    page.getByTestId("AuditTrailPage-table-value-modal-close").click();

    // Sorting by field, ascending, puts the comments change first too, and major second.
    page.getByTestId("AuditTrailPage-sort").selectOption("fieldName");
    page.getByTestId("AuditTrailPage-direction").selectOption("asc");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-0-col-fieldName"))
        .containsText("comments");
    page.getByTestId("AuditTrailPage-direction").selectOption("desc");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-0-col-fieldName"))
        .containsText("major");
  }

  @Test
  public void non_admins_are_denied_the_audit_trail_page() throws Exception {
    setupInstructorUser();
    goTo("/admin/audittrail");
    assertThat(page.getByText("You do not have access to this page.")).isVisible();
    assertThat(page.getByTestId("AuditTrailPage-total")).not().isVisible();
  }
}
