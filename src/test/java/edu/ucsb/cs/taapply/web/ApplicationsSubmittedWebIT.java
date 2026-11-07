package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * End-to-end coverage of what happens to an application once it is submitted: editing it past the
 * deadline (issue #98), cancelling it and starting over (issues #107, #318), the admin's review and
 * comments (issue #49), and an admin and the student editing it at the same time (issue #302).
 * Shared setup is in {@link ApplicationsWebTestCase}.
 */
public class ApplicationsSubmittedWebIT extends ApplicationsWebTestCase {

  /** Issue #98: past the deadline the application stays editable until the admin closes it. */
  @Test
  public void past_the_deadline_the_application_is_still_editable_until_closed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    fillAndSubmit();

    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");
    Long applicationId = applicationRepository.findAll().iterator().next().getId();

    // Move the deadline into the past, which is what an admin editing the recruitment would do.
    Recruitment stored = recruitmentRepository.findById(recruitment.getId()).orElseThrow();
    stored.setPrimaryConsiderationDate(LocalDate.now().minusDays(1));
    recruitmentRepository.save(stored);

    reloadPage(page);
    page.getByTestId(card + "view").click();

    // The whole form is still offered, and the comments box with it.
    assertThat(page.getByTestId("ApplicationPage-late-note")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-firstName")).hasValue("Chris");
    page.getByTestId("ApplicationPage-firstName").fill("Christina");
    page.getByTestId("ApplicationPage-submit").click();
    assertThat(page.getByText("Your application has been updated.")).isVisible();

    page.getByTestId("ApplicationPage-comments-postApplicationComments")
        .fill("Finished CS 290A since.");
    page.getByTestId("ApplicationPage-comments-submit").click();
    assertThat(page.getByText("Your comments have been saved.")).isVisible();

    // Both changes stuck.
    goTo("/applications/" + applicationId);
    assertThat(page.getByTestId("ApplicationPage-firstName")).hasValue("Christina");
    assertThat(page.getByTestId("ApplicationPage-comments-postApplicationComments"))
        .hasValue("Finished CS 290A since.");

    // Once the admin closes applications, editing is over; for six months the comments stay live.
    stored.setApplicationStatus(ApplicationStatus.CLOSED);
    stored.setActualClosingDate(LocalDate.now());
    recruitmentRepository.save(stored);

    goTo("/");
    assertThat(page.getByTestId(card + "applicationStatus")).containsText("CLOSED");
    assertThat(page.getByTestId(card + "view")).containsText("View/Comment on My Application");
    page.getByTestId(card + "view").click();
    assertThat(page.getByTestId("ApplicationPage-comments-only")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-firstName")).not().isVisible();
    assertThat(page.getByTestId("ApplicationPage-comments-postApplicationComments"))
        .hasValue("Finished CS 290A since.");
    page.getByTestId("ApplicationPage-comments-postApplicationComments").fill("And CS 290B too.");
    page.getByTestId("ApplicationPage-comments-submit").click();
    assertThat(page.getByText("Your comments have been saved.")).isVisible();

    // Closed more than six months ago, it is a past recruitment: read only, no comment box.
    stored.setActualClosingDate(LocalDate.now().minusMonths(7));
    recruitmentRepository.save(stored);
    goTo("/");
    assertThat(page.getByTestId(card + "card")).hasCount(0);
    page.getByTestId("HomePageLoggedIn-dashboard-past-cell-row-0-col-view-link").click();
    assertThat(page.getByTestId("ApplicationPage-view-only")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-comments-postApplicationComments")).hasCount(0);
    assertThat(page.getByTestId("ApplicationPage-saved-comments")).containsText("And CS 290B too.");
  }

  /** Issue #107: an applicant cancels their application through the two-step confirmation. */
  @Test
  public void an_applicant_can_cancel_their_application_with_a_reason() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    fillAndSubmit();

    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    String modal = "HomePageLoggedIn-dashboard-cancel-";
    page.getByTestId(card + "cancel").click();
    assertThat(page.getByTestId(modal + "step1-body")).containsText("Are you sure?");
    // Backing out changes nothing.
    page.getByTestId(modal + "step1-no").click();
    assertThat(page.getByTestId(modal + "step1")).not().isVisible();
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");

    page.getByTestId(card + "cancel").click();
    page.getByTestId(modal + "step1-yes").click();
    assertThat(page.getByTestId(modal + "step2-body")).containsText("not cancelled yet");
    assertThat(page.getByTestId(modal + "step2-yes")).isDisabled();
    page.getByTestId(modal + "reason").fill("Found other employment");
    page.getByTestId(modal + "step2-yes").click();

    assertThat(page.getByText("Your application has been cancelled.")).isVisible();
    assertThat(page.getByTestId(card + "applied")).containsText("Application cancelled");
    assertThat(page.getByTestId(card + "cancel")).hasCount(0);
    assertThat(page.getByTestId(card + "apply")).hasCount(0);

    // The application is final: read only, with the reason on record.
    page.getByTestId(card + "view").click();
    assertThat(page.getByTestId("ApplicationPage-status")).containsText("CANCELLED");
    assertThat(page.getByTestId("ApplicationPage-view-only")).containsText("You cancelled");
    assertThat(page.getByTestId("ApplicationPage-summary-Cancelled"))
        .containsText("Found other employment");

    Application stored = applicationRepository.findAll().iterator().next();
    assertEquals("Found other employment", stored.getCancellationReason());
  }

  /**
   * Issue #318: after cancelling, while applications are open, the applicant starts a new
   * application from scratch; the cancelled one is kept, and only the new one is live.
   */
  @Test
  public void an_applicant_who_cancelled_can_start_a_new_application() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    fillAndSubmit();

    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    String modal = "HomePageLoggedIn-dashboard-cancel-";
    assertThat(page.getByTestId(card + "restart")).hasCount(0);
    page.getByTestId(card + "cancel").click();
    page.getByTestId(modal + "step1-yes").click();
    page.getByTestId(modal + "reason").fill("Changed my mind");
    page.getByTestId(modal + "step2-yes").click();
    assertThat(page.getByTestId(card + "applied")).containsText("Application cancelled");

    // The cancelled application's own page offers the same button, and says the old one is kept.
    page.getByTestId(card + "view").click();
    assertThat(page.getByTestId("ApplicationPage-restart")).containsText("Start a new application");
    assertThat(page.getByTestId("ApplicationPage-restart-note")).containsText("stays on file");
    page.goBack();

    assertThat(page.getByTestId(card + "restart")).containsText("Start a new application");
    page.getByTestId(card + "restart").click();

    // As if from scratch: nothing is copied from the cancelled application.
    assertThat(page.getByTestId("ApplyPage-major")).hasValue("");
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).hasValue("");
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("0 of at least 3");
    fillAndSubmit();

    // The new application is the one on file, and can be cancelled in turn.
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");
    assertThat(page.getByTestId(card + "cancel")).isVisible();
    assertThat(page.getByTestId(card + "restart")).hasCount(0);

    List<Application> stored = new ArrayList<>();
    applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId()).forEach(stored::add);
    assertEquals(2, stored.size());
    assertEquals(ApplicationReviewStatus.CANCELLED, stored.get(0).getStatus());
    assertEquals("Changed my mind", stored.get(0).getCancellationReason());
    assertEquals(1, stored.get(0).getAttemptNumber());
    assertEquals(ApplicationReviewStatus.PENDING, stored.get(1).getStatus());
    assertEquals(2, stored.get(1).getAttemptNumber());

    // The cancelled application's page now points to the new one instead of offering a button.
    goTo("/applications/" + stored.get(0).getId());
    assertThat(page.getByTestId("ApplicationPage-new-application-link")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-restart")).hasCount(0);
  }

  /** An admin reviews the applications to a recruitment and leaves comments on one (issue #49). */
  @Test
  public void an_admin_can_review_the_applications_and_comment_on_one() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email("grad@ucsb.edu")
            .firstName("Ada")
            .lastName("Lovelace")
            .major("Computer Science")
            .classLevel(edu.ucsb.cs.taapply.enums.ClassLevel.PHD)
            // The other TA answers the form requires since issue #214, so the admin's edit
            // below changes only the major and the courses.
            .gpaMajor(3.9)
            .gpaOverall(3.8)
            .yearInProgram("2nd")
            .graduationDate("S27")
            .residencyStatus(edu.ucsb.cs.taapply.enums.ResidencyStatus.US_CITIZEN)
            .languageExam(edu.ucsb.cs.taapply.enums.LanguageExamStatus.EXEMPT_US_CITIZEN)
            .firstChoiceCourse("CMPSC   156")
            .build());

    setupAdminUser();
    goTo("/");
    page.getByTestId("HomePageLoggedIn-admin-card-0-applications-button").click();

    // The one recruitment repeated at the top, the count, and the application listed.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-recruitment-cell-row-0-col-type"))
        .containsText("TA");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("1 Application Received");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Ada Lovelace");
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-classLevel"))
        .containsText("PhD");
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-submittedAt"))
        .not()
        .isEmpty();

    // The id opens the read-only application; Save returns to the list with the comments kept.
    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-summary-Name")).containsText("Ada Lovelace");
    assertThat(page.getByTestId("AdminApplicationPage-about")).containsText("grad@ucsb.edu");
    page.getByTestId("AdminApplicationPage-adminComments").fill("Interview on Tuesday");
    page.getByTestId("AdminApplicationPage-save").click();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("1 Application Received");

    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-adminComments"))
        .hasValue("Interview on Tuesday");
    // Cancel goes back without saving.
    page.getByTestId("AdminApplicationPage-adminComments").fill("discarded");
    page.getByTestId("AdminApplicationPage-cancel").click();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count")).isVisible();
    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-adminComments"))
        .hasValue("Interview on Tuesday");
    // The Audit Trail card starts closed; open it (the setting is remembered from here on).
    assertThat(page.getByTestId("AdminApplicationPage-auditCard-toggle"))
        .hasAttribute("aria-expanded", "false");
    assertThat(page.getByTestId("AdminApplicationPage-audit-none")).not().isVisible();
    page.getByTestId("AdminApplicationPage-auditCard-toggle").click();
    // Nothing edited yet, so the audit trail section says so.
    assertThat(page.getByTestId("AdminApplicationPage-audit-none")).isVisible();

    // Edit the major; the change is saved and shows up in the application's audit trail.
    page.getByTestId("AdminApplicationPage-edit").click();
    assertThat(page.getByTestId("AdminApplicationEditPage-firstName")).hasValue("Ada");
    page.getByTestId("AdminApplicationEditPage-major").selectOption("__OTHER__");
    page.getByTestId("AdminApplicationEditPage-otherMajor").fill("Statistics");
    addCourse("AdminApplicationEditPage", "CMPSC 130A");
    addCourse("AdminApplicationEditPage", "CMPSC 130B");
    addCourse("AdminApplicationEditPage", "CMPSC 156");
    page.getByTestId("AdminApplicationEditPage-submit").click();

    assertThat(page.getByTestId("AdminApplicationPage-summary-Major")).containsText("Statistics");
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-0-col-fieldName"))
        .containsText("major");
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-0-col-oldValue"))
        .containsText("Computer Science");
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-0-col-newValue"))
        .containsText("Statistics");
    // Issue #337: each row names the admin who made the edit.
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-0-col-editorEmail"))
        .hasText("admin@ucsb.edu");
    // The three courses added are rows too, with a JSON new value and no old value.
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-1-col-fieldName"))
        .containsText("priorCoursework");
    assertThat(page.getByTestId("AdminApplicationPage-audit-cell-row-1-col-newValue-see"))
        .isVisible();

    // And the whole-table page lists them against the TA application.
    goTo("/admin/audittrail");
    assertThat(page.getByTestId("AuditTrailPage-total")).containsText("4 changes recorded.");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-3-col-app")).containsText("TA ");
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-3-col-app-link")).isVisible();
    assertThat(page.getByTestId("AuditTrailPage-table-cell-row-3-col-editorEmail"))
        .hasText("admin@ucsb.edu");
  }

  @Autowired edu.ucsb.cs.taapply.repository.UserRepository itUserRepository;
  @Autowired edu.ucsb.cs.taapply.repository.AdminRepository itAdminRepository;

  /** A submitted application of the given student, to the given recruitment. */
  private Application seedApplication(Recruitment recruitment, String email, String firstName) {
    return applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email(email)
            .status(edu.ucsb.cs.taapply.enums.ApplicationReviewStatus.PENDING)
            .firstName(firstName)
            .lastName("Gaucho")
            .build());
  }

  /**
   * Issue #302: an admin signs in, in a second browser context, as a different person from the
   * student whose window is already open. The student's window is {@code page}.
   */
  private com.microsoft.playwright.Page openAsAdmin(String path) {
    if (itUserRepository.findByEmail("admin@ucsb.edu").isEmpty()) {
      itUserRepository.save(
          edu.ucsb.cs.taapply.entity.User.builder()
              .email("admin@ucsb.edu")
              .familyName("Admin")
              .givenName("Ada")
              .fullName("Ada Admin")
              .googleSub("987654321")
              .pictureUrl("")
              .build());
      itAdminRepository.save(
          edu.ucsb.cs.taapply.entity.Admin.builder().email("admin@ucsb.edu").build());
    }
    edu.ucsb.cs.taapply.services.wiremock.WiremockServiceImpl.setupOauthMocks(
        wireMockServer, "admin@ucsb.edu");
    String base = page.url().replaceAll("(http://localhost:\\d+).*", "$1");
    com.microsoft.playwright.BrowserContext adminContext =
        newContext(new com.microsoft.playwright.Browser.NewContextOptions());
    com.microsoft.playwright.Page adminPage = newPage(adminContext);
    adminPage.navigate(base + "/oauth2/authorization/my-oauth-provider");
    adminPage.locator("#username").fill("admin@ucsb.edu");
    adminPage.locator("#password").fill("password");
    adminPage.locator("#submit").click();
    awaitSignedIn(adminPage);
    adminPage.navigate(base + path);
    awaitSettled(adminPage);
    return adminPage;
  }

  /**
   * Issue #302: the student has a submitted application open for editing and an admin opens the
   * admin edit page for the same application. Each is told of the other, in the maintainer's
   * wording; the warning goes when the admin closes the window; and an admin on a different
   * student's application warns no one.
   */
  @Test
  public void an_admin_and_a_student_editing_the_same_application_warn_each_other()
      throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    Application mine = seedApplication(recruitment, "cgaucho@ucsb.edu", "Chris");
    Application theirs = seedApplication(recruitment, "someone.else@ucsb.edu", "Sam");

    setupRegularUser();
    goTo("/applications/" + mine.getId());
    assertThat(page.getByTestId("ApplicationPage-submit")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs")).not().isVisible();

    com.microsoft.playwright.Page adminPage =
        openAsAdmin("/admin/applications/" + mine.getId() + "/edit");
    assertThat(adminPage.getByTestId("AdminApplicationEditPage-submit")).isVisible();

    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    // The student, whose window was open first, is told which admin has it.
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs"))
        .containsText(
            "Admin admin@ucsb.edu (Test User) has this application open for editing. We recommend"
                + " that you close this window and try again in a few minutes. If this message"
                + " persists, please reach out to admin@ucsb.edu");
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs-modal-leave")).not().isVisible();
    // The admin, who arrived last, is asked, with the student named.
    assertThat(adminPage.getByTestId("AdminApplicationEditPage-multiple-tabs-modal-message"))
        .isVisible(wait);
    assertThat(adminPage.getByTestId("AdminApplicationEditPage-multiple-tabs-modal-message"))
        .containsText(
            "cgaucho@ucsb.edu (Test User) already has this application open for editing. We"
                + " recommend that you wait a few minutes or ask them to close it.");

    // Closing the admin's window lets the student's warning go.
    adminPage.context().close();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs")).isHidden(gone);

    // An admin on another student's application warns no one: neither page shows a warning.
    com.microsoft.playwright.Page elsewhere =
        openAsAdmin("/admin/applications/" + theirs.getId() + "/edit");
    assertThat(elsewhere.getByTestId("AdminApplicationEditPage-submit")).isVisible();
    Thread.sleep(8000);
    assertThat(elsewhere.getByTestId("AdminApplicationEditPage-multiple-tabs")).not().isVisible();
    assertThat(elsewhere.getByTestId("AdminApplicationEditPage-multiple-tabs-modal-leave"))
        .not()
        .isVisible();
    assertThat(page.getByTestId("ApplicationPage-multiple-tabs")).not().isVisible();
  }
}
