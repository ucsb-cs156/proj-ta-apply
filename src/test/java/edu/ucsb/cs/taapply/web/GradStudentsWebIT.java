package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

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

/**
 * End-to-end coverage of the grad students admin pages, including the bulk CSV email upload that is
 * the new feature in iteration 1.
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
public class GradStudentsWebIT extends WebTestCase {

  private void goToGradStudentsPage() {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/gradstudents"));
  }

  @Test
  public void admin_can_add_a_grad_student() throws Exception {
    setupAdminUser();
    goToGradStudentsPage();

    page.getByText("New Grad Student").click();
    page.getByTestId("RoleEmailForm-email").fill("student1@ucsb.edu");
    page.getByTestId("RoleEmailForm-submit").click();

    assertThat(page.getByTestId("GradStudentsIndexPage-cell-row-0-col-email"))
        .containsText("student1@ucsb.edu");
  }

  @Test
  public void admin_can_bulk_upload_emails_from_a_csv() throws Exception {
    setupAdminUser();
    goToGradStudentsPage();

    page.getByTestId("GradStudentCSVUploadForm-upload")
        .setInputFiles(
            new FilePayload(
                "grads.csv",
                "text/csv",
                "email\nstudent2@ucsb.edu\nstudent3@ucsb.edu\n".getBytes(StandardCharsets.UTF_8)));
    page.getByTestId("GradStudentCSVUploadForm-submit").click();

    assertThat(page.getByText("2 added")).isVisible();
    assertThat(page.getByTestId("GradStudentsIndexPage-cell-row-0-col-email"))
        .containsText("student2@ucsb.edu");
    assertThat(page.getByTestId("GradStudentsIndexPage-cell-row-1-col-email"))
        .containsText("student3@ucsb.edu");
  }

  @Test
  public void re_uploading_the_same_csv_does_not_duplicate_rows() throws Exception {
    setupAdminUser();
    goToGradStudentsPage();

    FilePayload csv =
        new FilePayload(
            "grads.csv", "text/csv", "email\nstudent4@ucsb.edu\n".getBytes(StandardCharsets.UTF_8));

    page.getByTestId("GradStudentCSVUploadForm-upload").setInputFiles(csv);
    page.getByTestId("GradStudentCSVUploadForm-submit").click();
    assertThat(page.getByText("1 added")).isVisible();

    page.getByTestId("GradStudentCSVUploadForm-upload").setInputFiles(csv);
    page.getByTestId("GradStudentCSVUploadForm-submit").click();
    assertThat(page.getByText("0 added, 1 already present")).isVisible();

    // Still exactly one row for that address.
    assertThat(page.getByTestId("GradStudentsIndexPage-cell-row-0-col-email"))
        .containsText("student4@ucsb.edu");
    assertThat(page.getByTestId("GradStudentsIndexPage-cell-row-1-col-email")).not().isVisible();
  }

  @Test
  public void non_admin_is_denied_access_to_the_grad_students_page() throws Exception {
    setupRegularUser();
    goToGradStudentsPage();

    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }
}
