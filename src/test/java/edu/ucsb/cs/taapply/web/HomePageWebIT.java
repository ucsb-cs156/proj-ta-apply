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
  public void logged_in_regular_user_sees_only_the_student_section() throws Exception {
    setupRegularUser();

    // Everyone signed in is a student as far as applying goes (issue #107); only that section,
    // and with no other section to tell it from, no Student heading either (issue #118).
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-greeting")).hasCount(0);
    assertThat(page.locator("h1")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications are not currently being accepted.");
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_admin_sees_the_admin_section_and_the_student_one() throws Exception {
    setupAdminUser();

    assertThat(page.getByTestId("HomePageLoggedIn-admin")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).containsText("Admin");
    // The recruitments table, empty here: just its headings.
    assertThat(page.getByTestId("HomePageLoggedIn-admin-recruitments")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasText("Student");
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_instructor_sees_the_instructor_section_and_the_student_one()
      throws Exception {
    setupInstructorUser();

    assertThat(page.getByTestId("HomePageLoggedIn-instructor-soon"))
        .containsText("Instructor Functions Coming Soon");
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
  }
}
