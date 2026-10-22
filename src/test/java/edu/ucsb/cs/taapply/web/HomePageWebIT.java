package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/**
 * Verifies that a logged-in user sees the home page, and that it reflects the roles they actually
 * hold.
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
public class HomePageWebIT extends WebTestCase {

  @Test
  public void logged_in_regular_user_sees_greeting_and_ula_message() throws Exception {
    setupRegularUser();

    // "Test" comes from the mock OAuth provider's given_name claim, not from the User row the
    // test seeds: GoogleSignInServiceImpl treats the OIDC token as the source of truth for
    // profile fields and overwrites the stored values on each sign-in.
    assertThat(page.getByTestId("HomePageLoggedIn-greeting")).containsText("Welcome, Test.");
    assertThat(page.getByTestId("HomePageLoggedIn-undergrad")).isVisible();
    // An undergrad applies for ULA positions, so that is what the dashboard talks about.
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications for ULA positions are not currently being accepted.");
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
  }

  @Test
  public void logged_in_admin_sees_the_admin_message() throws Exception {
    setupAdminUser();

    assertThat(page.getByTestId("HomePageLoggedIn-admin")).isVisible();
    // Roles are independent: being an admin does not make you an applicant.
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard")).not().isVisible();
    // Nor an undergrad who would apply for a ULA position.
    assertThat(page.getByTestId("HomePageLoggedIn-undergrad")).not().isVisible();
  }

  @Test
  public void logged_in_instructor_does_not_see_the_ula_message() throws Exception {
    setupInstructorUser();

    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-undergrad")).not().isVisible();
  }

  /** A grad student gets the applicant dashboard, for TA positions, not the ULA message. */
  @Test
  public void logged_in_grad_student_sees_the_ta_dashboard_and_not_the_ula_message()
      throws Exception {
    setupGradStudentUser();

    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications for TA positions are not currently being accepted.");
    assertThat(page.getByTestId("HomePageLoggedIn-undergrad")).not().isVisible();
  }
}
