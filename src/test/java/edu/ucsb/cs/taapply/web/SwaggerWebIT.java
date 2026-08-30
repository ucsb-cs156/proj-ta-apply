package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
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
 * Verifies that the Swagger UI page loads correctly.
 *
 * <p>This is intentionally a light-weight smoke test: it only checks that the API definition loaded
 * successfully and that at least one known controller tag (Admin) is rendered on the page. This is
 * meant to catch cases where the Swagger page fails to load entirely, without requiring frequent
 * updates as the API surface changes.
 *
 * <p>Prerequisites: the frontend must be built ({@code npm run build} inside {@code frontend/}) so
 * that {@code target/classes/public/index.html} exists. Run with:
 *
 * <pre>
 * INTEGRATION=true mvn test
 * </pre>
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class SwaggerWebIT extends WebTestCase {

  @Test
  public void swagger_ui_page_loads_successfully() throws Exception {
    setupRegularUser();
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/swagger-ui/index.html"));

    // Swagger UI fetches and renders the OpenAPI definition asynchronously, which can
    // take longer than Playwright's default 5s timeout on a busy CI runner. Wait for
    // either a successful render (the Admin tag) or a failed one (the error message)
    // to appear before making any assertions; this avoids a race where the "not
    // contains" check below could pass simply because the page has not finished
    // loading yet.
    Locator adminTag =
        page.locator("span").filter(new Locator.FilterOptions().setHasText("Admin")).first();
    Locator failedToLoadMessage = page.getByText("Failed to load API definition");
    adminTag
        .or(failedToLoadMessage)
        .first()
        .waitFor(new Locator.WaitForOptions().setTimeout(30000));

    assertThat(page.locator("body")).not().containsText("Failed to load API definition");
    assertThat(adminTag).isVisible();
  }
}
