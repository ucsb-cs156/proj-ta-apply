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
 * Verifies that a logged-in user sees their home page, including the projects they own and/or
 * collaborate on.
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
  public void logged_in_regular_user_sees_home_page() throws Exception {
    setupRegularUser();
    assertThat(page.getByText("Projects You Collaborate On")).isVisible();
    assertThat(page.getByText("You are not a collaborator on any projects yet.")).isVisible();
  }

  @Test
  public void logged_in_instructor_can_create_a_project_and_see_it_listed() throws Exception {
    setupInstructorUser();
    assertThat(page.getByText("Your Projects")).isVisible();

    page.getByText("Create Project").click();
    page.locator("#name").fill("Citation Graphs");
    page.locator("#description").fill("A project about citation graphs");
    page.getByTestId("ProjectModal-submit").click();

    assertThat(page.getByTestId("OwnerProjectTable-cell-row-0-col-name-link"))
        .containsText("Citation Graphs");
  }
}
