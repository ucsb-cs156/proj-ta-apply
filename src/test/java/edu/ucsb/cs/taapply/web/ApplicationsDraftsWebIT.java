package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * End-to-end coverage of draft applications (issues #270, #292, #296) and of editing a draft in two
 * windows at once (issues #273, #284). Shared setup is in {@link ApplicationsWebTestCase}.
 */
public class ApplicationsDraftsWebIT extends ApplicationsWebTestCase {

  /**
   * Issue #292: the box is part of the draft, so a draft saved with it ticked comes back ticked.
   */
  @Test
  public void the_first_quarter_box_is_kept_in_the_draft() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    page.getByTestId("ApplyPage-firstQuarter").check();
    page.getByTestId("ApplyPage-saveDraft").click();

    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    assertThat(page.getByTestId(card + "draft")).containsText("Continue editing draft application");
    assertEquals(
        Boolean.TRUE, draftApplicationRepository.findAll().iterator().next().getFirstQuarter());
    page.getByTestId(card + "draft").click();
    assertThat(page.getByTestId("ApplyPage-firstQuarter")).isChecked();
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).isDisabled();
  }

  /**
   * Issue #270: nothing typed is lost. Opening the form makes a draft; Save Draft keeps what was
   * typed and returns home, where the card offers to continue it; continuing brings it back;
   * submitting turns it into the application and removes the draft.
   */
  @Test
  public void a_draft_is_saved_resumed_and_replaced_by_the_application() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/");
    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    assertThat(page.getByTestId(card + "apply")).containsText("Apply to be a TA");
    page.getByTestId(card + "apply").click();

    // Opening the form made the draft, empty.
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();
    assertThat(page.getByTestId("ApplyPage-submit")).isVisible();
    assertEquals(1, draftApplicationRepository.count());
    assertEquals(null, draftApplicationRepository.findAll().iterator().next().getFirstName());

    // Incomplete, and saved all the same: no required answer is asked for.
    page.getByTestId("ApplyPage-firstName").fill("Dana");
    page.getByTestId("ApplyPage-gpaMajor").fill("3.4");
    page.getByTestId("ApplyPage-comments").fill("Saved before I finished");
    page.getByTestId("ApplyPage-saveDraft").click();

    // Home again, where the card offers the draft instead of Apply and warns it is incomplete.
    assertThat(page.getByTestId(card + "applied")).containsText("Draft application");
    assertThat(page.getByTestId(card + "draft")).containsText("Continue editing draft application");
    assertThat(page.getByTestId(card + "draft-warning"))
        .containsText(
            "Your application is not yet complete; incomplete applications are not considered.");
    assertThat(page.getByTestId(card + "apply")).not().isVisible();
    assertEquals(1, draftApplicationRepository.count());
    DraftApplication saved = draftApplicationRepository.findAll().iterator().next();
    assertEquals("Dana", saved.getFirstName());
    assertEquals(3.4, saved.getGpaMajor());
    assertEquals("Saved before I finished", saved.getComments());
    assertEquals(0, applicationRepository.count());

    // Continuing brings back what was typed.
    page.getByTestId(card + "draft").click();
    assertThat(page.getByTestId("ApplyPage-firstName")).hasValue("Dana");
    assertThat(page.getByTestId("ApplyPage-gpaMajor")).hasValue("3.4");
    assertThat(page.getByTestId("ApplyPage-comments")).hasValue("Saved before I finished");
    // Still the one draft: opening it again made no second.
    assertEquals(1, draftApplicationRepository.count());

    fillAndSubmit();

    // Submitted: the application is on file and the draft is gone.
    assertThat(page.getByTestId(card + "applied")).containsText("Application on File");
    assertThat(page.getByTestId(card + "view")).containsText("View submitted application");
    assertThat(page.getByTestId(card + "draft")).not().isVisible();
    assertEquals(1, applicationRepository.count());
    assertEquals(0, draftApplicationRepository.count());
  }

  /**
   * Issue #296: an admin sees the applications students have started, counted at the top of the
   * Draft Applications page, with no way to edit them, and leaves a comment on one. When the
   * student submits, the draft leaves the page and the comment is on the application.
   */
  @Test
  public void an_admin_sees_a_draft_comments_on_it_and_the_comment_moves_to_the_application()
      throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    // The student starts an application and saves it unfinished.
    setupRegularUser();
    goTo("/");
    String card = "HomePageLoggedIn-dashboard-current-card-" + recruitment.getId() + "-";
    page.getByTestId(card + "apply").click();
    page.getByTestId("ApplyPage-firstName").fill("Dana");
    page.getByTestId("ApplyPage-lastName").fill("Draft");
    page.getByTestId("ApplyPage-saveDraft").click();
    assertThat(page.getByTestId(card + "draft")).isVisible();
    assertEquals(1, draftApplicationRepository.count());

    // The admin finds it from the recruitment's card, counted, in the Applications table's columns
    // but with no Edit column.
    browser.close();
    setupAdminUser();
    goTo("/");
    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-draft-applications-button"))
        .containsText("Draft Applications");
    page.getByTestId("HomePageLoggedIn-admin-card-0-draft-applications-button").click();
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-count"))
        .containsText("1 Draft Application");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-name"))
        .containsText("Dana Draft");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-email"))
        .containsText("cgaucho@ucsb.edu");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-drafts-header-submittedAt"))
        .containsText("Last saved");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-drafts-header-edit")).hasCount(0);

    // Opening it shows what the student has so far, read only, with a box for comments.
    page.getByTestId("RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-summary-Name")).containsText("Dana Draft");
    assertThat(page.getByTestId("AdminApplicationPage-about")).containsText("has not submitted it");
    assertThat(page.getByTestId("AdminApplicationPage-edit")).hasCount(0);
    page.getByTestId("AdminApplicationPage-adminComments").fill("Strong; ask about CMPSC 156");
    page.getByTestId("AdminApplicationPage-save").click();
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-count"))
        .containsText("1 Draft Application");
    page.getByTestId("RecruitmentDraftApplicationsPage-drafts-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-adminComments"))
        .hasValue("Strong; ask about CMPSC 156");
    // The comment did not touch the draft, so the student's autosave is not disturbed.
    assertEquals(1, draftApplicationRepository.count());
    assertEquals(0, applicationRepository.count());

    // The student carries on and submits; their draft never showed the comment.
    browser.close();
    loginAs("cgaucho@ucsb.edu");
    goTo("/");
    page.getByTestId(card + "draft").click();
    assertThat(page.getByTestId("ApplyPage-firstName")).hasValue("Dana");
    fillAndSubmit();
    assertThat(page.getByTestId(card + "view")).containsText("View submitted application");
    assertEquals(0, draftApplicationRepository.count());
    assertEquals(1, applicationRepository.count());
    assertEquals(
        "Strong; ask about CMPSC 156",
        applicationRepository.findAll().iterator().next().getAdminComments());

    // The draft has left the admin's page, and the comment is on the application.
    browser.close();
    loginAs("admin@ucsb.edu");
    goTo("/admin/recruitments/" + recruitment.getId() + "/draft-applications");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-count"))
        .containsText("0 Draft Applications");
    assertThat(page.getByTestId("RecruitmentDraftApplicationsPage-none")).isVisible();
    goTo("/admin/recruitments/" + recruitment.getId() + "/applications");
    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-adminComments"))
        .hasValue("Strong; ask about CMPSC 156");
  }

  /**
   * Issue #270: without pressing anything, what is typed reaches the draft within a few seconds.
   */
  @Test
  public void what_is_typed_is_saved_to_the_draft_without_pressing_anything() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    page.getByTestId("ApplyPage-comments").fill("Typed and left alone");

    // Polled, since the save comes a few seconds after the typing.
    long deadline = System.currentTimeMillis() + 15000;
    String saved = null;
    while (System.currentTimeMillis() < deadline) {
      saved = draftApplicationRepository.findAll().iterator().next().getComments();
      if (saved != null) {
        break;
      }
      Thread.sleep(250);
    }
    assertEquals("Typed and left alone", saved);

    // Closing the page and coming back finds it, though Save Draft was never pressed.
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-comments")).hasValue("Typed and left alone");
    assertEquals(1, draftApplicationRepository.count());
    assertEquals(0, applicationRepository.count());
  }

  /**
   * Issue #270: a draft saved from a second window is not silently overwritten by the first. The
   * first window is told, does not go home, and can reload to see what the second saved.
   */
  @Test
  public void a_draft_saved_in_another_window_is_not_overwritten() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    String applyUrl = "/apply/" + recruitment.getId();
    goTo(applyUrl);
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();

    // A second window, signed in as the same person, opens the same draft and saves it.
    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(page.url());
    awaitSettled(otherPage);
    // The newer window is asked what to do (issue #284); this one carries on.
    otherPage.getByTestId("ApplyPage-multiple-tabs-modal-continue").click();
    otherPage.getByTestId("ApplyPage-comments").fill("From the second window");
    otherPage.getByTestId("ApplyPage-saveDraft").click();
    assertThat(otherPage.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertEquals(
        "From the second window",
        draftApplicationRepository.findAll().iterator().next().getComments());

    // The first window still has the draft as it opened it. Saving is refused, and says why.
    page.getByTestId("ApplyPage-comments").fill("From the first window");
    page.getByTestId("ApplyPage-saveDraft").click();
    assertThat(page.getByTestId("ApplyPage-conflict"))
        .containsText(
            "This draft was changed in another tab or window. Reload to see the latest version.");
    assertThat(page.getByTestId("ApplyPage-submit")).isVisible();
    assertEquals(
        "From the second window",
        draftApplicationRepository.findAll().iterator().next().getComments());

    // Reload shows what the second window saved, and the draft can be saved again.
    page.getByTestId("ApplyPage-conflict-reload").click();
    assertThat(page.getByTestId("ApplyPage-comments")).hasValue("From the second window");
    assertThat(page.getByTestId("ApplyPage-conflict")).not().isVisible();
    page.getByTestId("ApplyPage-comments").fill("Now from the first window");
    page.getByTestId("ApplyPage-saveDraft").click();
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertEquals(
        "Now from the first window",
        draftApplicationRepository.findAll().iterator().next().getComments());
    assertEquals(1, draftApplicationRepository.count());
  }

  /**
   * Issue #273: a second window on the same draft brings a warning in both, and the warning goes
   * once the second window is closed. The integration profile shortens the window to six seconds
   * (and so the heartbeat to two) so this can be watched happening.
   */
  @Test
  public void a_second_window_on_the_same_draft_brings_a_warning_that_goes_when_it_closes()
      throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();

    // Alone, there is nothing to warn about.
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).not().isVisible();

    // A second window, signed in as the same person, opens the same draft.
    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(page.url());
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("ApplyPage-saveDraft")).isVisible();

    // Both are told, the first at its next heartbeat and the second at its first.
    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId("ApplyPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("ApplyPage-multiple-tabs"))
        .containsText(
            "You are also editing this application in another tab or window."
                + " Please know that this is risky; we recommend closing all but one of these.");
    // Issue #284: only the newer window is asked what to do; the older one has the banner alone.
    assertThat(otherPage.getByTestId("ApplyPage-multiple-tabs-modal-leave")).isVisible();
    assertThat(page.getByTestId("ApplyPage-multiple-tabs-modal-leave")).not().isVisible();
    // The form is still there to use, and the draft is still the one.
    assertThat(page.getByTestId("ApplyPage-submit")).isVisible();
    assertEquals(1, draftApplicationRepository.count());

    // Closing the second window lets the warning go: it ages out, and the first window hears so.
    other.close();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isHidden(gone);
    assertEquals(1, draftApplicationRepository.count());
  }

  /** A second window of the same person on the same draft; the newer of the two. */
  private com.microsoft.playwright.Page openSecondWindow() {
    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(page.url());
    awaitSettled(otherPage);
    return otherPage;
  }

  private static final String MODAL = "ApplyPage-multiple-tabs-modal";

  /**
   * Issue #284: Continue anyway closes the question, leaves the banner, and lets the newer window
   * be used.
   */
  @Test
  public void the_newer_window_can_continue_anyway() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();

    com.microsoft.playwright.Page otherPage = openSecondWindow();
    otherPage.getByTestId(MODAL + "-continue").click();

    assertThat(otherPage.getByTestId(MODAL + "-continue")).not().isVisible();
    assertThat(otherPage.getByTestId("ApplyPage-multiple-tabs")).isVisible();
    otherPage.getByTestId("ApplyPage-comments").fill("Typed after continuing");
    assertThat(otherPage.getByTestId("ApplyPage-comments")).hasValue("Typed after continuing");
    // It does not come back at the next heartbeats (two seconds apart here).
    otherPage.waitForTimeout(5000);
    assertThat(otherPage.getByTestId(MODAL + "-continue")).not().isVisible();
  }

  /**
   * Issue #284: Leave this page says goodbye and goes home, so the other window's warning goes in a
   * few seconds, well inside the six seconds that silence alone would take.
   */
  @Test
  public void leaving_from_the_newer_window_clears_the_warning_in_the_other_quickly()
      throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();
    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);

    com.microsoft.playwright.Page otherPage = openSecondWindow();
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isVisible(wait);

    otherPage.getByTestId(MODAL + "-leave").click();

    assertThat(otherPage.getByTestId("HomePageLoggedIn-student")).isVisible();
    var soon =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(4500);
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isHidden(soon);
    assertEquals(1, draftApplicationRepository.count());
  }

  /**
   * Issue #284: choosing to wait keeps the newer window covered, and it resumes by itself once the
   * other window has gone. Moving the older window to the home page is how it goes.
   */
  @Test
  public void the_newer_window_can_wait_for_the_other_to_go_and_then_resume() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();

    com.microsoft.playwright.Page otherPage = openSecondWindow();
    otherPage.getByTestId(MODAL + "-wait").click();
    assertThat(otherPage.getByTestId(MODAL + "-waiting")).isVisible();
    // The older window is not covered, and is not asked anything.
    assertThat(page.getByTestId(MODAL + "-wait")).not().isVisible();
    page.getByTestId("ApplyPage-comments").fill("Still typing in the first window");

    goTo("/");

    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(15000);
    assertThat(otherPage.getByTestId(MODAL + "-waiting")).isHidden(gone);
    assertThat(otherPage.getByTestId("ApplyPage-multiple-tabs")).not().isVisible();
    otherPage.getByTestId("ApplyPage-comments").fill("Resumed here");
    assertThat(otherPage.getByTestId("ApplyPage-comments")).hasValue("Resumed here");
  }

  /**
   * Issue #284: closing one of two windows lets the other's warning go, by the goodbye if it is
   * delivered and by the heartbeats stopping if it is not.
   */
  @Test
  public void closing_one_of_two_windows_clears_the_warning_in_the_other() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();
    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-saveDraft")).isVisible();
    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);

    com.microsoft.playwright.Page otherPage = openSecondWindow();
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isVisible(wait);

    otherPage.close();

    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(15000);
    assertThat(page.getByTestId("ApplyPage-multiple-tabs")).isHidden(gone);
    assertEquals(1, draftApplicationRepository.count());
  }

  /**
   * Issue #273: the applicant Help pages end with a Simultaneous Editing section that shows the
   * warning.
   */
  @Test
  public void the_help_pages_explain_simultaneous_editing() throws Exception {
    setupRegularUser();

    goTo("/help/ta-applicants");
    assertThat(page.getByTestId("HelpTaApplicantsPage-simultaneous-editing"))
        .containsText("Simultaneous Editing");
    assertThat(page.getByTestId("HelpTaApplicantsPage-simultaneous-editing-example"))
        .containsText("You are also editing this application in another tab or window.");

    goTo("/help/ula-applicants");
    assertThat(page.getByTestId("HelpUlaApplicantsPage-simultaneous-editing-example"))
        .containsText("Please know that this is risky; we recommend closing all but one of these.");
  }
}
