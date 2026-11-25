package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.HiringStaff;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/** Issue #504: the Hiring Staff role and the Admin → Hiring Staff page that grants it. */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class HiringStaffWebIT extends WebTestCase {

  @Test
  public void admin_adds_and_removes_hiring_staff_from_the_admin_menu() throws Exception {
    setupAdminUser();
    openPage(page, "/");

    page.getByTestId("appnavbar-admin-dropdown").click();
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Hiring Staff")).click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).hasText("Hiring Staff");
    assertThat(page.getByTestId("HiringStaffIndexPage-role-note"))
        .containsText("Hiring Staff see the Soft Offer Results");
    assertEquals(0, page.getByTestId("HiringStaffIndexPage-cell-row-0-col-email").count());

    // Add one: the email is canonicalized (case, umail), and the row has no name until they sign
    // in.
    page.getByTestId("HiringStaffIndexPage-create").click();
    assertThat(page.getByRole(AriaRole.HEADING).first()).hasText("Add New Hiring Staff");
    page.getByTestId("RoleEmailForm-email").fill("Finance@umail.ucsb.edu");
    page.getByTestId("RoleEmailForm-submit").click();
    assertThat(page.getByText("New hiring staff added - email:")).isVisible();
    assertThat(page.getByTestId("HiringStaffIndexPage-cell-row-0-col-email"))
        .hasText("finance@ucsb.edu");
    assertThat(page.getByTestId("HiringStaffIndexPage-cell-row-0-col-givenName")).hasText("");
    assertTrue(hiringStaffRepository.existsByEmail("finance@ucsb.edu"));

    // Every row can be deleted: there is no ADMIN_EMAILS-style seed list for this role.
    page.getByTestId("HiringStaffIndexPage-cell-row-0-col-delete-button").click();
    assertThat(page.getByTestId("HiringStaffIndexPage-cell-row-0-col-email")).hasCount(0);
    assertFalse(hiringStaffRepository.existsByEmail("finance@ucsb.edu"));
  }

  @Test
  public void the_users_page_shows_who_is_hiring_staff() throws Exception {
    userRepository.save(
        User.builder()
            .email("finance@ucsb.edu")
            .givenName("Fin")
            .familyName("Ance")
            .fullName("Fin Ance")
            .googleSub("987654321")
            .pictureUrl("")
            .build());
    hiringStaffRepository.save(HiringStaff.builder().email("finance@ucsb.edu").build());
    setupAdminUser();
    openPage(page, "/admin/users");

    // Rows are in id order: the hiring staff member was saved first, the admin second.
    assertThat(page.getByTestId("UsersTable-cell-row-0-col-email")).hasText("finance@ucsb.edu");
    assertThat(page.getByTestId("UsersTable-cell-row-0-col-hiringStaff")).hasText("true");
    assertThat(page.getByTestId("UsersTable-cell-row-0-col-admin")).hasText("false");
    assertThat(page.getByTestId("UsersTable-cell-row-1-col-email")).hasText("admin@ucsb.edu");
    assertThat(page.getByTestId("UsersTable-cell-row-1-col-hiringStaff")).hasText("false");
    assertThat(page.getByTestId("UsersTable-cell-row-1-col-admin")).hasText("true");
  }

  /** The role itself grants nothing yet (issue #505 adds its section): no Admin menu, no pages. */
  @Test
  public void hiring_staff_have_no_admin_menu_and_are_denied_the_admin_pages() throws Exception {
    setupHiringStaffUser();
    openPage(page, "/");

    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("appnavbar-admin-dropdown")).hasCount(0);

    openPage(page, "/admin/hiringStaff");
    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }
}
