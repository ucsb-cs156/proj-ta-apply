package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.HiringStaff;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

  /** The role grants only its own section (issue #505): no Admin menu, no admin pages. */
  @Test
  public void hiring_staff_have_no_admin_menu_and_are_denied_the_admin_pages() throws Exception {
    setupHiringStaffUser();
    openPage(page, "/");

    assertThat(page.getByTestId("HomePageLoggedIn-hiring-staff-recruitments-none"))
        .hasText("No ULA recruitment has released soft offers yet.");
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("appnavbar-admin-dropdown")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).hasCount(0);

    openPage(page, "/admin/hiringStaff");
    assertThat(page.getByText("You do not have access to this page.")).isVisible();
    openPage(page, "/admin/recruitments/1/applications");
    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }

  /** A closed recruitment with hiring decisions released, of the given type, for F26. */
  private Recruitment.RecruitmentBuilder published(RecruitmentType type) {
    return Recruitment.builder()
        .quarter("20264")
        .type(type)
        .applicationStatus(ApplicationStatus.CLOSED)
        .reviewStatus("Closed")
        .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
        .primaryConsiderationDate(LocalDate.of(2026, 9, 20))
        .assignmentsPublished(true)
        .assignmentsPublishedAt(LocalDateTime.of(2026, 10, 1, 9, 0));
  }

  /**
   * Issue #505: the Hiring Staff section has a card only for the ULA recruitment whose soft offers
   * are released, with one button, Soft Offer Results; the page opens for them, Change Deadline
   * included, and the change is written to the recruitment's history.
   */
  @Test
  public void hiring_staff_see_released_ula_recruitments_and_can_change_the_deadline()
      throws Exception {
    Recruitment released =
        recruitmentRepository.save(
            published(RecruitmentType.ULA)
                .softOffersReleasedAt(LocalDateTime.of(2026, 10, 20, 9, 30))
                .softOfferDeadline(LocalDateTime.of(2999, 12, 1, 17, 0))
                .build());
    // Neither of these has soft offer results: a TA recruitment, and a ULA one not yet released.
    recruitmentRepository.save(published(RecruitmentType.TA).build());
    recruitmentRepository.save(published(RecruitmentType.ULA).quarter("20271").build());
    setupHiringStaffUser();
    openPage(page, "/");

    String section = "HomePageLoggedIn-hiring-staff-recruitments";
    String card = section + "-card-" + released.getId() + "-";
    assertThat(page.getByTestId(card + "name")).hasText("F26 ULA");
    assertThat(page.getByTestId(card + "release"))
        .hasText("Soft offers released 10/20/2026, 9:30:00 AM. Deadline: 12/1/2999, 5:00:00 PM.");
    assertEquals(1, page.getByTestId(section).locator("[data-testid$='-card']").count());
    assertEquals(
        1, page.getByTestId(card + "card").locator("a, button").count(), "one button only");
    assertThat(page.getByTestId(section + "-none")).hasCount(0);

    page.getByTestId(card + "soft-offer-results-button").click();
    assertThat(page.getByTestId("SoftOfferResultsPage-title"))
        .hasText("Soft Offer Results: F26 ULA");
    assertThat(page.getByTestId("SoftOfferResultsPage-counts"))
        .hasText("0 assigned ULAs: 0 proceed, 0 declined, 0 no response yet.");
    assertThat(page.getByTestId("SoftOfferResultsPage-csv")).isVisible();

    String modal = "SoftOfferResultsPage-deadline";
    page.getByTestId("SoftOfferResultsPage-change-deadline").click();
    assertThat(page.getByTestId(modal + "-deadline-input")).hasValue("2999-12-01T17:00");
    page.getByTestId(modal + "-deadline-input").fill("2999-12-15T12:00");
    page.getByTestId(modal + "-confirm").click();
    assertThat(page.getByText("Soft offer deadline changed.")).isVisible();
    assertThat(page.getByTestId("SoftOfferResultsPage-release"))
        .containsText("Deadline: 12/15/2999, 12:00:00 PM.");
    Recruitment after = recruitmentRepository.findById(released.getId()).orElseThrow();
    assertEquals(LocalDateTime.of(2999, 12, 15, 12, 0), after.getSoftOfferDeadline());
    assertEquals(LocalDateTime.of(2026, 10, 20, 9, 30), after.getSoftOffersReleasedAt());
  }
}
