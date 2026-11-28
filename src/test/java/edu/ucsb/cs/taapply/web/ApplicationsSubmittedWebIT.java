package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
   * Issues #318, #420: after cancelling, while applications are open, Create a new application
   * turns the cancelled application back into a draft with its answers (not the reason), removes
   * the cancelled row, and opens the draft; submitting it leaves one application, not two.
   */
  @Test
  public void an_applicant_who_cancelled_can_create_a_new_application_from_it() throws Exception {
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
    Long cancelledId = applicationRepository.findAll().iterator().next().getId();

    // The cancelled application's own page offers the same button, and says what it does.
    page.getByTestId(card + "view").click();
    assertThat(page.getByTestId("ApplicationPage-restart"))
        .containsText("Create a new application");
    assertThat(page.getByTestId("ApplicationPage-restart-note"))
        .containsText("back into a draft with your answers, but not your reason for cancelling");
    page.goBack();

    assertThat(page.getByTestId(card + "restart")).containsText("Create a new application");
    page.getByTestId(card + "restart").click();

    // The draft opens with the earlier answers, and the cancelled application is gone.
    assertThat(page.getByTestId("ApplyPage-firstName")).hasValue("Chris");
    assertThat(page.getByTestId("ApplyPage-major")).hasValue("Computer Science");
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).hasValue("3.9");
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("3 of at least 3");
    assertThat(page.getByTestId("ApplyPage-notice-agree")).isChecked();
    assertThat(page.getByText("Changed my mind")).hasCount(0);
    assertEquals(0, applicationRepository.count());
    var draft =
        draftApplicationRepository
            .findByEmailAndRecruitmentId("cgaucho@ucsb.edu", recruitment.getId())
            .orElseThrow();
    assertEquals("Gaucho", draft.getLastName());

    page.getByTestId("ApplyPage-submit").click();

    // One application on file, which can be cancelled in turn; no cancelled one beside it.
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");
    assertThat(page.getByTestId(card + "cancel")).isVisible();
    assertThat(page.getByTestId(card + "restart")).hasCount(0);

    List<Application> stored = new ArrayList<>();
    applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId()).forEach(stored::add);
    assertEquals(1, stored.size());
    assertEquals(ApplicationReviewStatus.PENDING, stored.get(0).getStatus());
    assertEquals(null, stored.get(0).getCancellationReason());
    assertEquals(1, stored.get(0).getAttemptNumber());
    assertEquals("Chris", stored.get(0).getFirstName());
    assertEquals(0, draftApplicationRepository.count());

    // The cancelled application's page is gone with it.
    assertEquals(false, applicationRepository.existsById(cancelledId));
  }

  /**
   * Issue #440: Hide moves an application to the list at the bottom of the page and out of what is
   * ranked and assigned; Unhide moves it back.
   */
  @Test
  public void an_admin_can_hide_an_application_and_unhide_it() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    Long gsrId =
        applicationRepository
            .save(
                Application.builder()
                    .recruitmentId(recruitment.getId())
                    .email("gsr@ucsb.edu")
                    .firstName("Grace")
                    .lastName("Hopper")
                    .build())
            .getId();
    applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email("grad@ucsb.edu")
            .firstName("Ada")
            .lastName("Lovelace")
            .build());

    setupAdminUser();
    goTo("/");
    page.getByTestId("HomePageLoggedIn-admin-card-0-applications-button").click();

    // Nothing is hidden yet: both applications are in the table, and the hidden list is empty.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Grace Hopper");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-count"))
        .hasText("0 Hidden Applications");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-empty")).isVisible();

    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-hiding-button")
        .click();

    // The row has moved to the hidden list, and the one left is the other applicant's.
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-hidden-applications-cell-row-0-col-name"))
        .containsText("Grace Hopper");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Ada Lovelace");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-1-col-name"))
        .hasCount(0);
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-count"))
        .hasText("1 Hidden Application");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("2 Applications Received");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-among"))
        .containsText("1 of them is hidden");
    assertEquals(true, applicationRepository.findById(gsrId).orElseThrow().isHidden());
    // What faculty rank and admins assign no longer includes it.
    assertEquals(
        List.of("grad@ucsb.edu"),
        edu.ucsb.cs.taapply.services.ApplicationVisibility.real(
                applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId()), false)
            .stream()
            .map(Application::getEmail)
            .toList());

    page.getByTestId("RecruitmentApplicationsPage-hidden-applications-cell-row-0-col-hiding-button")
        .click();

    // Back where it was.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-empty")).isVisible();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Grace Hopper");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-1-col-name"))
        .containsText("Ada Lovelace");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-hidden-among")).hasCount(0);
    assertEquals(false, applicationRepository.findById(gsrId).orElseThrow().isHidden());
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
    // Issue #322: an application the applicant cancelled is listed too, marked in red.
    applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email("withdrawn@ucsb.edu")
            .firstName("Edsger")
            .lastName("Dijkstra")
            .status(ApplicationReviewStatus.CANCELLED)
            .cancellationReason("Accepted a research position")
            .cancelledAt(LocalDateTime.now())
            .build());

    setupAdminUser();
    goTo("/");
    page.getByTestId("HomePageLoggedIn-admin-card-0-applications-button").click();

    // The one recruitment repeated at the top, the count, and the applications listed.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-recruitment-cell-row-0-col-type"))
        .containsText("TA");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("2 Applications Received");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Ada Lovelace");
    // The live application has no badge beside its id; the cancelled one has a red "cancelled".
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-cell-row-0-col-id-cancelled"))
        .hasCount(0);
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-1-col-name"))
        .containsText("Edsger Dijkstra");
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-cell-row-1-col-id-cancelled"))
        .hasText("cancelled");
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-cell-row-1-col-id-cancelled"))
        .hasClass(java.util.regex.Pattern.compile("text-bg-danger"));
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-classLevel"))
        .containsText("PhD");
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-submittedAt"))
        .not()
        .isEmpty();
    // Issue #421: the TA form asks no availability, so neither the table nor its Columns menu
    // offers the availability columns.
    page.getByTestId("RecruitmentApplicationsPage-columns-toggle").click();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-columns-classLevel")).isVisible();
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-columns-availableForLecturesFirstChoice"))
        .hasCount(0);
    page.getByTestId("RecruitmentApplicationsPage-columns-toggle").click();
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-header-availableForLecturesFirstChoice"))
        .hasCount(0);
    assertThat(
            page.locator(
                "th",
                new com.microsoft.playwright.Page.LocatorOptions().setHasText("Lecture (1st)")))
        .hasCount(0);

    // The id opens the read-only application; Save returns to the list with the comments kept.
    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-summary-Name")).containsText("Ada Lovelace");
    assertThat(page.getByTestId("AdminApplicationPage-about")).containsText("grad@ucsb.edu");
    page.getByTestId("AdminApplicationPage-adminComments").fill("Interview on Tuesday");
    page.getByTestId("AdminApplicationPage-save").click();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("2 Applications Received");

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

  /**
   * Issue #421: availability is a ULA question, so a ULA recruitment's Applications and Draft
   * Applications tables offer its six columns, with the answers the students gave.
   */
  @Test
  public void a_ula_table_has_the_availability_columns() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.ULA, LocalDate.now().plusDays(30));
    applicationRepository.save(
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email("ula@ucsb.edu")
            .firstName("Una")
            .lastName("Ula")
            .firstChoiceCourse("CMPSC   156")
            .availableForLecturesFirstChoice(true)
            .availabilityCommentsFirstChoice("Not before 10 on Mondays")
            .build());
    draftApplicationRepository.save(
        edu.ucsb.cs.taapply.entity.DraftApplication.builder()
            .recruitmentId(recruitment.getId())
            .email("drafter@ucsb.edu")
            .firstName("Dana")
            .lastName("Draft")
            .availableForDiscussionSecondChoice(true)
            .build());

    setupAdminUser();
    goTo("/admin/recruitments/" + recruitment.getId() + "/applications");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Una Ula");
    // The availability columns start hidden; the Columns menu offers them, and Show All shows them.
    page.getByTestId("RecruitmentApplicationsPage-columns-toggle").click();
    assertThat(
            page.getByTestId("RecruitmentApplicationsPage-columns-availableForLecturesFirstChoice"))
        .isVisible();
    page.getByTestId("RecruitmentApplicationsPage-columns-select-all").click();
    page.getByTestId("RecruitmentApplicationsPage-columns-toggle").click();
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-header-availableForLecturesFirstChoice"))
        .containsText("Lecture (1st)");
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-cell-row-0-col-availableForLecturesFirstChoice"))
        .hasText("Yes");
    assertThat(
            page.getByTestId(
                "RecruitmentApplicationsPage-applications-cell-row-0-col-availabilityCommentsFirstChoice"))
        .hasText("Not before 10 on Mondays");

    // The drafts table shares the columns and the choice of which are shown.
    goTo("/admin/recruitments/" + recruitment.getId() + "/draft-applications");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-name"))
        .containsText("Dana Draft");
    assertThat(
            page.getByTestId(
                "RecruitmentDraftApplicationsPage-drafts-header-availableForLecturesFirstChoice"))
        .containsText("Lecture (1st)");
    assertThat(
            page.getByTestId(
                "RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-availableForDiscussionSecondChoice"))
        .hasText("Yes");
  }

  @Autowired edu.ucsb.cs.taapply.repository.UserRepository itUserRepository;
  @Autowired edu.ucsb.cs.taapply.repository.AdminRepository itAdminRepository;

  /** A submitted application of the given student, to the given recruitment. */
  @org.springframework.beans.factory.annotation.Autowired
  edu.ucsb.cs.taapply.repository.SoftOfferNoticeVersionRepository softOfferNoticeVersionRepository;

  @org.springframework.beans.factory.annotation.Autowired
  edu.ucsb.cs.taapply.repository.SoftOfferResponseRepository softOfferResponseRepository;

  /**
   * Issue #486: once soft offers are released for a ULA recruitment, an applicant assigned to a
   * lecture sees the Soft Offer section on the recruitment's card, with the lecture, its sections
   * (from the UCSB API), the notice text filled in for the quarter and the question; answering once
   * turns it read-only, and a second answer is refused by the backend.
   */
  @Test
  public void an_assigned_ula_applicant_answers_their_soft_offer_once() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.ULA, LocalDate.of(2021, 9, 20));
    recruitment.setApplicationStatus(ApplicationStatus.CLOSED);
    recruitment.setActualClosingDate(LocalDate.now());
    recruitment.setReviewStatus("Closed");
    recruitment.setAssignmentsPublished(true);
    recruitment.setSoftOffersReleasedAt(java.time.LocalDateTime.of(2026, 11, 20, 9, 30));
    recruitment.setSoftOfferDeadline(java.time.LocalDateTime.of(2099, 12, 1, 17, 0));
    recruitmentRepository.save(recruitment);
    edu.ucsb.cs.taapply.entity.RecruitmentCourse lecture =
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
            .filter(c -> "07492".equals(c.getEnrollCode()))
            .findFirst()
            .orElseThrow();
    lecture.setInstructor("CONRAD P");
    lecture.setDays("T R");
    lecture.setTime("14:00 - 15:15");
    recruitmentCourseRepository.save(lecture);
    softOfferNoticeVersionRepository.save(
        edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion.builder()
            .content("# Congratulations\n\nThis is for ${quarter}.")
            .createdAt(java.time.LocalDateTime.of(2026, 11, 1, 9, 0))
            .build());
    Application mine = seedApplication(recruitment, "cgaucho@ucsb.edu", "Chris");
    mine.setTentativeAssignmentId(lecture.getId());
    applicationRepository.save(mine);
    // Another applicant, not assigned: no soft offer for them (checked through the API below).
    seedApplication(recruitment, "other@ucsb.edu", "Grace");

    setupRegularUser();
    String section =
        "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-soft-offer";
    assertThat(page.getByTestId(section + "-title")).hasText("Soft Offer");
    assertThat(page.getByTestId(section + "-intro"))
        .hasText("You have been recommended for a ULA position for the following course:");
    assertThat(page.getByTestId(section + "-course-number")).hasText("CMPSC 156");
    assertThat(page.getByTestId(section + "-course-instructor")).hasText("CONRAD P");
    assertThat(page.getByTestId(section + "-course-days")).hasText("T R");
    assertThat(page.getByTestId(section + "-course-begin")).hasText("14:00");
    assertThat(page.getByTestId(section + "-course-end")).hasText("15:15");
    // The two discussion sections the stubbed UCSB API lists under lecture 0100.
    assertThat(page.getByTestId(section + "-section-0")).containsText("0101");
    assertThat(page.getByTestId(section + "-section-0")).containsText("09:50");
    assertThat(page.getByTestId(section + "-section-1")).containsText("0102");
    assertThat(page.getByTestId(section + "-notice").locator("h1")).hasText("Congratulations");
    assertThat(page.getByTestId(section + "-notice")).containsText("This is for Fall 2021.");
    assertThat(page.getByTestId(section + "-deadline"))
        .containsText("Please choose an option below by 12/1/2099, 5:00:00 PM.");
    assertThat(page.getByTestId(section + "-submit")).isDisabled();

    page.getByTestId(section + "-choice-PROCEED").check();
    page.getByTestId(section + "-comments").fill("Looking forward to it.");
    page.getByTestId(section + "-submit").click();

    assertThat(page.getByText("Your response has been recorded.")).isVisible();
    assertThat(page.getByTestId(section + "-answer-decision"))
        .hasText("Please proceed with a formal offer; I am likely to accept.");
    assertThat(page.getByTestId(section + "-answer-comments")).hasText("Looking forward to it.");
    assertThat(page.getByTestId(section + "-answer-sentence"))
        .containsText("You have indicated that you would like to proceed to a formal offer.");
    assertThat(page.getByTestId(section + "-form")).hasCount(0);
    java.util.List<edu.ucsb.cs.taapply.entity.SoftOfferResponse> answers =
        softOfferResponseRepository.findByApplicationIdIn(java.util.List.of(mine.getId()));
    assertEquals(1, answers.size());
    assertEquals(edu.ucsb.cs.taapply.enums.SoftOfferDecision.PROCEED, answers.get(0).getDecision());
    assertEquals(lecture.getId(), answers.get(0).getRecruitmentCourseId());

    // Still read-only after a reload.
    reloadPage(page);
    assertThat(page.getByTestId(section + "-answer-decision")).isVisible();
    assertThat(page.getByTestId(section + "-form")).hasCount(0);

    // Issue #487: an admin sees the answer on the Soft Offer Results page, and in its CSV.
    com.microsoft.playwright.Page admin =
        openAsAdmin("/admin/recruitments/" + recruitment.getId() + "/softOffers");
    assertThat(admin.getByTestId("SoftOfferResultsPage-title"))
        .hasText("Soft Offer Results: F21 ULA");
    assertThat(admin.getByTestId("SoftOfferResultsPage-counts"))
        .hasText("1 assigned ULA: 1 proceed, 0 declined, 0 no response yet.");
    assertThat(admin.getByTestId("SoftOfferResultsPage-table-cell-row-0-col-status"))
        .hasText("Proceed");
    assertThat(admin.getByTestId("SoftOfferResultsPage-table-cell-row-0-col-comments"))
        .hasText("Looking forward to it.");
    assertThat(admin.getByTestId("SoftOfferResultsPage-unassigned")).hasCount(0);

    // Issue #511: the Copy Soft Offer Emails buttons. Chris proceeded; nobody declined or is
    // without an answer, so those two buttons are disabled.
    admin.context().grantPermissions(java.util.List.of("clipboard-read", "clipboard-write"));
    assertThat(admin.getByTestId("SoftOfferResultsPage-copy-emails-label"))
        .hasText("Copy Soft Offer Emails:");
    assertThat(admin.getByTestId("SoftOfferResultsPage-copy-emails-declined")).isDisabled();
    assertThat(admin.getByTestId("SoftOfferResultsPage-copy-emails-none")).isDisabled();
    admin.getByTestId("SoftOfferResultsPage-copy-emails-all").click();
    assertThat(admin.getByText("1 email copied to clipboard.")).isVisible();
    assertEquals("cgaucho@ucsb.edu", admin.evaluate("navigator.clipboard.readText()"));
    admin.getByTestId("SoftOfferResultsPage-copy-emails-proceed").click();
    assertEquals("cgaucho@ucsb.edu", admin.evaluate("navigator.clipboard.readText()"));

    com.microsoft.playwright.Download download =
        admin.waitForDownload(() -> admin.getByTestId("SoftOfferResultsPage-csv").click());
    assertEquals("soft-offers-" + recruitment.getId() + ".csv", download.suggestedFilename());
    java.util.List<String> lines = java.nio.file.Files.readAllLines(download.path());
    assertEquals(
        "\"First name\",\"Last name\",\"Email\",\"Perm number\",\"Prev LA Qtrs\","
            + "\"Expected grad date\",\"Other Campus Job?\",\"Employee ID number\","
            + "\"Course assignment\",\"Funding\",\"Course instructor\","
            + "\"Course instructor email\",\"First time ULA\",\"Offer Status\","
            + "\"Offer Response Date/Time\",\"Student Comments\",\"Formal Offer Sent\","
            + "\"Formal Offer Sent Date/Time\",\"Formal Offer Accepted\","
            + "\"Formal Offer Accepted Date/Time\",\"New Hire form done (or not needed)\","
            + "\"New Hire form Date/Time\",\"Other Campus Job FLSA conflict found\","
            + "\"Other Campus Job FLSA conflict found Date/Time\","
            + "\"Other Campus Job FLSA conflict resolved\","
            + "\"Other Campus Job FLSA conflict resolved Date/Time\",\"In UCPath\","
            + "\"In UCPath Date/Time\",\"I-9 Complete\",\"I-9 Complete Date/Time\","
            + "\"Staff Comments\"",
        lines.get(0));
    org.junit.jupiter.api.Assertions.assertTrue(
        lines
            .get(1)
            .startsWith(
                "\"Chris\",\"Gaucho\",\"cgaucho@ucsb.edu\",\"\",\"\",\"\",\"\",\"\",\"CMPSC 156\",\"\","),
        lines.get(1));
    org.junit.jupiter.api.Assertions.assertTrue(lines.get(1).contains("\"Proceed\""), lines.get(1));
  }

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
