package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
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

@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class OauthWebIT extends WebTestCase {

  @Test
  public void regular_user_can_login_and_logout() throws Exception {
    setupRegularUser();
    assertThat(page.getByText("Log Out")).isVisible();
    page.getByText("Log Out").click();

    // After logout, "/" itself shows the login screen (HomePageLoggedOut).
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/"));

    assertThat(
            page.getByRole(
                AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Log In").setExact(true)))
        .isVisible();
    assertThat(
            page.getByRole(
                AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Log In with Google")))
        .isVisible();
    assertThat(page.getByText("Log Out")).not().isVisible();
  }

  @Test
  public void admin_user_can_login() throws Exception {
    setupAdminUser();
    assertThat(page.getByText("Log Out")).isVisible();
  }

  @Test
  public void user_in_ADMIN_EMAILS_gets_admin_access_without_being_manually_added()
      throws Exception {
    // app.admin.emails=admingaucho@ucsb.edu in application-integration.properties; this user is
    // never inserted into the admins table by this test, only by ScaffoldStartup at app startup.
    setupUserWithEmail("admingaucho@ucsb.edu");

    assertThat(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Admin")))
        .isVisible();
  }
}
