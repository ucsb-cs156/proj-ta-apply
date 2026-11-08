package edu.ucsb.cs.taapply.web;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/**
 * End-to-end coverage of recruitments, with the UCSB API stubbed on the same WireMock server that
 * mocks OAuth, so no API key is needed.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class RecruitmentsWebIT extends WebTestCase {

  @Autowired BudgetRepository budgetRepository;

  /** The recruitments are on the admin's home page (issue #141). */
  private void goToRecruitments() {
    openPage(page, "/");
  }

  /** CMPSC 156 with two lectures, and CMPSC 130A which only wants a ULA. */
  private void stubOfferings() {
    wireMockServer.stubFor(
        get(urlPathEqualTo("/academics/curriculums/v1/classes/search"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                        {"classes":[
                          {"courseId":"CMPSC   156  ","title":"ADV APP PROGRAM","classSections":[
                            {"enrollCode":"07492","section":"0100","enrolledTotal":120,
                             "maxEnroll":150,
                             "timeLocations":[{"days":"T R","beginTime":"14:00","endTime":"15:15",
                                               "building":"PHELP","room":"3526"}],
                             "instructors":[{"instructor":"CONRAD P"}]},
                            {"enrollCode":"07500","section":"0200","enrolledTotal":60,
                             "maxEnroll":80,
                             "timeLocations":[{"days":"T R","beginTime":"15:30","endTime":"16:45",
                                               "building":"PHELP","room":"3526"}],
                             "instructors":[{"instructor":"SOMEONE ELSE"}]},
                            {"enrollCode":"07493","section":"0101","enrolledTotal":30,
                             "maxEnroll":40,"timeLocations":[],"instructors":[]}
                          ]},
                          {"courseId":"CMPSC   130A ","title":"DATA STRUCT","classSections":[
                            {"enrollCode":"07600","section":"0100","enrolledTotal":90,
                             "maxEnroll":100,"timeLocations":[],"instructors":[]}
                          ]}
                        ]}
                        """)));
  }

  /**
   * The by-enroll-code lookups: 130A's lecture, which the TA recruitment does not flag, and 156's
   * discussion section, which comes back inside the whole 156 offering.
   */
  private void stubOfferingsByEnrollCode() {
    wireMockServer.stubFor(
        get(urlPathMatching("/academics/curriculums/v1/classes/[0-9]+/07493"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                        {"courseId":"CMPSC   156  ","title":"ADV APP PROGRAM","classSections":[
                          {"enrollCode":"07492","section":"0100","enrolledTotal":120,
                           "maxEnroll":150,"timeLocations":[],"instructors":[]},
                          {"enrollCode":"07493","section":"0101","enrolledTotal":30,
                           "maxEnroll":40,"timeLocations":[],"instructors":[]}
                        ]}
                        """)));
    wireMockServer.stubFor(
        get(urlPathMatching("/academics/curriculums/v1/classes/[0-9]+/07600"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                        {"courseId":"CMPSC   130A ","title":"DATA STRUCT","classSections":[
                          {"enrollCode":"07600","section":"0100","enrolledTotal":90,
                           "maxEnroll":100,"timeLocations":[],
                           "instructors":[{"instructor":"HANDS ON"}]}
                        ]}
                        """)));
  }

  private void createTaRecruitment() {
    // The form is in a modal behind the Create New Recruitment button (issue #108).
    page.getByTestId("HomePageLoggedIn-admin-create-button").click();
    page.getByTestId("RecruitmentForm-tentativeOpeningDate").fill("2026-01-05");
    page.getByTestId("RecruitmentForm-primaryConsiderationDate").fill("2026-01-20");
    page.getByTestId("RecruitmentForm-submit").click();
  }

  /** Issue #278: the Courses page opens view-only; the Edit button leads to the edit page. */
  private void openEditPage() {
    page.getByTestId("RecruitmentCoursesPage-edit-button").click();
    waitFor(page.getByTestId("RecruitmentCoursesPage-view-link"));
  }

  private void waitFor(Locator locator) {
    for (int i = 0; i < 20 && !locator.isVisible(); i++) {
      page.waitForTimeout(500);
      reloadPage(page);
    }
  }

  /** YYYYQ to the QYY the pages use in their URLs, as the frontend's yyyyqToQyy: 20271 is W27. */
  private static String qyy(String yyyyq) {
    return "WSMF".charAt(yyyyq.charAt(4) - '1') + yyyyq.substring(2, 4);
  }

  @Test
  public void creating_a_recruitment_fills_it_with_only_the_matching_courses() throws Exception {
    // 156 wants a TA; 130A wants only a ULA.
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());
    courseRepository.save(
        Course.builder().courseId("CMPSC   130A").title("DATA STRUCT").needsUla(true).build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();

    createTaRecruitment();

    Locator firstRow = page.getByTestId("HomePageLoggedIn-admin-card-0-quarter");
    waitFor(firstRow);
    assertThat(firstRow).isVisible();

    // Issue #357: a QXX Budget card sits above the quarter's cards. Since issue #358 it has Budget
    // Planning and one allocation button, labelled by the quarter's recruitments (only a TA one
    // exists here), which opens the quarter's Combined Allocation page.
    assertThat(
            page.locator("[data-testid^='HomePageLoggedIn-admin-budget-'][data-testid$='-title']"))
        .containsText("Budget");
    assertThat(
            page.locator("[data-testid^='HomePageLoggedIn-admin-budget-'][data-testid$='-budget']"))
        .containsText("Budget Planning");
    Locator allocate =
        page.locator("[data-testid^='HomePageLoggedIn-admin-budget-'][data-testid$='-allocate']");
    assertThat(allocate).containsText("Allocate TA slots to Courses");
    assertThat(allocate).hasAttribute("href", Pattern.compile("/admin/allocations/[WSMF]\\d\\d"));

    page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);

    // Both lectures of 156, with their own instructors; no 130A, and no discussion section.
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-instructor"))
        .containsText("CONRAD P");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-1-col-instructor"))
        .containsText("SOMEONE ELSE");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-1-col-enrollment"))
        .containsText("60");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-2-col-courseId"))
        .not()
        .isVisible();
  }

  /**
   * Issue #384: a new quarter's budget, created when the first recruitment of the quarter gets a
   * course, starts as a copy of the most recent earlier quarter's, and the new recruitment's hiring
   * target as the one of the same type's recruitment in that quarter.
   */
  @Test
  public void a_new_quarters_budget_and_hiring_target_start_as_a_copy_of_the_last_quarters()
      throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());
    // A quarter long past, planned in full: 12 TAs and every figure of the budget entered.
    recruitmentRepository.save(
        Recruitment.builder()
            .quarter("20232")
            .type(RecruitmentType.TA)
            .applicationStatus(ApplicationStatus.CLOSED)
            .tentativeOpeningDate(LocalDate.of(2023, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2023, 1, 20))
            .totalHiringTarget(12)
            .build());
    budgetRepository.save(
        Budget.builder()
            .quarter("20232")
            .unrestrictedBudget(new BigDecimal("699315.00"))
            .tasOnlyBudget(new BigDecimal("0.00"))
            .ulasOnlyBudget(new BigDecimal("166667.00"))
            .taCostPerQuarter(new BigDecimal("13110.00"))
            .ulaRateDollarsPerHour(new BigDecimal("29.38"))
            .estimatedHoursPerULAPerQuarter(new BigDecimal("110.00"))
            .giftFundsForASEs(new BigDecimal("32200.00"))
            .conversionTAtoULA(2.5)
            .version(7)
            .conversionVersion(3)
            .build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    // The form proposes an upcoming quarter, so the new recruitment is later than 20232.
    createTaRecruitment();
    // The form's POST is asynchronous: wait for the new recruitment to be on file.
    Recruitment created = null;
    for (int i = 0; i < 40 && created == null; i++) {
      page.waitForTimeout(250);
      created =
          recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
              .filter(r -> !"20232".equals(r.getQuarter()))
              .findFirst()
              .orElse(null);
    }
    assertNotNull(created, "the form created the recruitment");
    assertEquals(12, created.getTotalHiringTarget(), "the TA target is the earlier TA's");

    // Populate fills its courses, which is what creates the quarter's budget (issue #363).
    openPage(page, "/admin/recruitments/" + created.getId() + "/courses");
    waitFor(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId"));
    Budget copy = budgetRepository.findById(created.getQuarter()).orElseThrow();
    assertEquals(2.5, copy.getConversionTAtoULA());
    assertEquals(new BigDecimal("13110.00"), copy.getTaCostPerQuarter());
    // The counters are the new row's own.
    assertEquals(0, copy.getVersion());
    assertEquals(0, copy.getConversionVersion());

    // The Budget page of the new quarter shows the copied figures and the copied target.
    openPage(page, "/admin/budget/" + qyy(created.getQuarter()));
    assertThat(page.getByTestId("BudgetPage-bottom-line")).isVisible();
    assertThat(page.getByTestId("BudgetPage-taCostPerQuarter")).hasValue("13110");
    assertThat(page.getByTestId("BudgetPage-ulaRateDollarsPerHour")).hasValue("29.38");
    assertThat(page.getByTestId("BudgetPage-estimatedHoursPerULAPerQuarter")).hasValue("110");
    assertThat(page.getByTestId("BudgetPage-giftFundsForASEs")).hasValue("32200");
    assertThat(page.getByTestId("BudgetPage-unrestrictedBudget")).hasValue("699315");
    assertThat(page.getByTestId("BudgetPage-tasOnlyBudget")).hasValue("0");
    assertThat(page.getByTestId("BudgetPage-ulasOnlyBudget")).hasValue("166667");
    assertThat(page.getByTestId("BudgetPage-ulaCost")).hasText("$3,231.80");
    assertThat(page.getByTestId("BudgetPage-target-ta-input")).hasValue("12");
    assertThat(page.getByTestId("BudgetPage-target-ula-none")).isVisible();
    // The earlier quarter's budget is untouched.
    assertEquals(7, budgetRepository.findById("20232").orElseThrow().getVersion());
  }

  /** Issue #125: an admin can add an unflagged course's lecture by its enroll code. */
  @Test
  public void an_admin_can_add_a_lecture_by_enroll_code() throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());

    stubOfferings();
    stubOfferingsByEnrollCode();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator firstRow = page.getByTestId("HomePageLoggedIn-admin-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);
    openEditPage();
    waitFor(firstCourse);
    assertThat(page.getByTestId("RecruitmentCoursesPage-add")).isDisabled();

    page.getByTestId("RecruitmentCoursesPage-enrollCode").fill("07600");
    page.getByTestId("RecruitmentCoursesPage-add").click();

    assertThat(page.getByText("Added CMPSC   130A section 0100 (07600).")).isVisible();
    // Sorted by course id, 130A sits first, flagged as added by hand.
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId"))
        .containsText("CMPSC   130A");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-manual")).containsText("manual");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-instructor"))
        .containsText("HANDS ON");
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-1-manual")).not().isVisible();
    assertThat(page.getByTestId("RecruitmentCoursesPage-enrollCode")).hasValue("");

    // A discussion section is refused with the reason.
    page.getByTestId("RecruitmentCoursesPage-enrollCode").fill("07493");
    page.getByTestId("RecruitmentCoursesPage-add").click();
    assertThat(page.getByText("is section 0101, a discussion or lab")).isVisible();
  }

  /**
   * Issue #366: the Allocation Visibility dialog offers two states, admins only and each faculty
   * member's own courses, and no third one; saving the second is what the panel then reports.
   */
  @Test
  public void the_allocation_visibility_dialog_offers_two_states_and_saves_the_choice()
      throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator firstRow = page.getByTestId("HomePageLoggedIn-admin-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);
    openEditPage();
    waitFor(firstCourse);

    String panel = "RecruitmentCoursesPage-allocation-visibility";
    assertThat(page.getByTestId(panel + "-message"))
        .containsText("Allocation visibility: Admins only.");
    page.getByTestId(panel + "-change").click();

    Locator modal = page.getByTestId(panel + "-modal");
    assertThat(modal).containsText("Who may see the allocations of this recruitment's courses?");
    assertThat(modal.getByRole(AriaRole.RADIO)).hasCount(2);
    assertThat(modal.getByTestId(panel + "-modal-ADMINS_ONLY")).isChecked();
    assertThat(modal.getByLabel("Admins only. No faculty member sees any allocation.")).isVisible();
    assertThat(
            modal.getByLabel(
                "Each faculty member sees the allocations only for the courses they teach."))
        .isVisible();
    assertThat(modal.getByTestId(panel + "-modal-ALL_COURSES")).hasCount(0);
    assertThat(modal).not().containsText("all courses");
    assertThat(modal)
        .containsText(
            "You can still change allocations afterwards; faculty see changes immediately.");

    modal.getByTestId(panel + "-modal-OWN_COURSES").check();
    modal.getByTestId(panel + "-modal-save").click();

    assertThat(page.getByText("Allocation visibility is now: Faculty see their own courses."))
        .isVisible();
    assertThat(page.getByTestId(panel + "-message"))
        .containsText("Allocation visibility: Faculty see their own courses.");
  }

  /**
   * Issue #278: the Courses page opens view-only, with an Edit button; the edit page warns when a
   * second window of the same admin has it open, and the view-only page never does.
   */
  @Test
  public void the_courses_page_is_view_only_and_only_the_edit_page_warns() throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator firstRow = page.getByTestId("HomePageLoggedIn-admin-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);
    // View-only: the Edit button and its words, and nothing to change.
    assertThat(page.getByTestId("RecruitmentCoursesPage-edit-text"))
        .containsText("Click Edit to: populate the course list, add a lecture by enroll code,");
    assertThat(page.getByTestId("RecruitmentCoursesPage-add")).not().isVisible();
    // Issue #358: the budget columns left this page for the Combined Allocation page, which the
    // page points to.
    assertThat(page.getByTestId("RecruitmentCoursesPage-header-allocation")).not().isVisible();
    assertThat(page.getByTestId("RecruitmentCoursesPage-combined-link"))
        .hasAttribute("href", Pattern.compile("/admin/allocations/[WSMF]\\d\\d"));
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-removed-button"))
        .not()
        .isVisible();

    // A second window on the view-only page: no warning anywhere.
    String viewUrl = page.url();
    com.microsoft.playwright.BrowserContext other =
        newContext(
            new com.microsoft.playwright.Browser.NewContextOptions()
                .setStorageState(page.context().storageState()));
    com.microsoft.playwright.Page otherPage = newPage(other);
    otherPage.navigate(viewUrl);
    awaitSettled(otherPage);
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-edit-button")).isVisible();
    page.waitForTimeout(5000);
    assertThat(page.getByTestId("RecruitmentCoursesPage-multiple-tabs")).not().isVisible();
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs")).not().isVisible();

    // The edit page in both: each is told about the other; the newer is asked what to do.
    openEditPage();
    otherPage.getByTestId("RecruitmentCoursesPage-edit-button").click();
    var wait =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
            .setTimeout(20000);
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs")).isVisible(wait);
    assertThat(page.getByTestId("RecruitmentCoursesPage-multiple-tabs")).isVisible(wait);
    // The shared admin wording (#298). Both windows are the same admin, so the later one says "You
    // already have" and the earlier "You are also editing", and both end with the admin sentence.
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs"))
        .containsText("You already have this page open for editing in another tab or window.");
    assertThat(page.getByTestId("RecruitmentCoursesPage-multiple-tabs"))
        .containsText("You are also editing this page in another tab or window.");
    assertThat(page.getByTestId("RecruitmentCoursesPage-multiple-tabs"))
        .containsText("We recommend that only one admin edits this page at a time.");
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs-modal-leave"))
        .isVisible();

    // Leave this page goes back to the view-only page, and the first window's warning goes.
    otherPage.getByTestId("RecruitmentCoursesPage-multiple-tabs-modal-leave").click();
    assertThat(otherPage.getByTestId("RecruitmentCoursesPage-edit-button")).isVisible();
    var gone =
        new com.microsoft.playwright.assertions.LocatorAssertions.IsHiddenOptions()
            .setTimeout(30000);
    assertThat(page.getByTestId("RecruitmentCoursesPage-multiple-tabs")).isHidden(gone);
    other.close();
  }

  @Test
  public void a_removed_course_stays_hidden_until_the_toggle_reveals_it() throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator firstRow = page.getByTestId("HomePageLoggedIn-admin-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);
    openEditPage();
    waitFor(firstCourse);
    // Issue #300: only the default columns show at first; the Remove button's column is one of the
    // others, so it is ticked in the Columns menu.
    page.getByTestId("RecruitmentCoursesPage-columns-toggle").click();
    page.getByTestId("RecruitmentCoursesPage-columns-removed").check();

    page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-removed-button").click();

    // Gone from the default view.
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-1-col-courseId"))
        .not()
        .isVisible();

    // The toggle brings it back, offering Unremove rather than Remove.
    page.getByTestId("RecruitmentCoursesPage-show-removed").check();
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-removed-button"))
        .containsText("Unremove");

    // And it can be put back.
    page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-removed-button").click();
    assertThat(page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-removed-button"))
        .containsText("Remove");
  }

  @Test
  public void opening_a_recruitment_records_the_date_and_closing_records_the_other()
      throws Exception {
    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    // Issue #233: Open Applications is step 2 of the live diagram on the card.
    Locator statusButton =
        page.getByTestId("HomePageLoggedIn-admin-card-0-steps-steps-step-2-action");
    waitFor(statusButton);
    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-applicationStatus"))
        .containsText("CLOSED");
    statusButton.click();

    // Issue #186: the button asks first. Nothing changes until Yes is clicked.
    Locator statusModal = page.getByTestId("HomePageLoggedIn-admin-status-modal");
    waitFor(statusModal);
    assertThat(statusModal).containsText("Are you sure?");
    assertThat(statusModal)
        .containsText("Applicants will be able to submit applications for this recruitment");
    assertThat(page.getByTestId("HomePageLoggedIn-admin-status-modal-help"))
        .hasAttribute("href", "/help/admins#open-close-applications");
    page.getByTestId("HomePageLoggedIn-admin-status-modal-no").click();
    assertThat(statusModal).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-applicationStatus"))
        .containsText("CLOSED");

    statusButton.click();
    waitFor(page.getByTestId("HomePageLoggedIn-admin-status-modal-yes"));
    assertThat(page.getByTestId("HomePageLoggedIn-admin-status-modal-yes"))
        .hasText("Yes, Open Applications Now");
    page.getByTestId("HomePageLoggedIn-admin-status-modal-yes").click();

    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-applicationStatus"))
        .containsText("OPEN");
    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-actualOpeningDate")).not().isEmpty();

    // Issue #139: the Applications page lists the recruitment's own audit trail, newest
    // first: the stamped opening date, the status change, then the creation.
    page.getByTestId("HomePageLoggedIn-admin-card-0-applications-button").click();
    // Issue #255: the Change History card starts closed, so open it first.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-changeHistory-toggle"))
        .hasAttribute("aria-expanded", "false");
    page.getByTestId("RecruitmentApplicationsPage-changeHistory-toggle").click();
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-total"))
        .hasText("3 changes recorded.");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-0-col-whatChanged"))
        .hasText("actualOpeningDate");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-0-col-oldValue"))
        .hasText("");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-0-col-newValue"))
        .hasText(java.time.LocalDate.now().toString());
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-1-col-whatChanged"))
        .hasText("applicationStatus");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-1-col-oldValue"))
        .hasText("CLOSED");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-1-col-newValue"))
        .hasText("OPEN");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-2-col-whatChanged"))
        .hasText("created");
    // Issue #337: every row, the creation included, names the admin who made the change.
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-0-col-editorEmail"))
        .hasText("admin@ucsb.edu");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-audit-cell-row-2-col-editorEmail"))
        .hasText("admin@ucsb.edu");
  }

  /**
   * Issue #234: the Applications page hands the browser a file named after the recruitment, with
   * the TA columns. (Until #233 the button was on the recruitment card.)
   */
  @Test
  public void the_applications_page_downloads_the_recruitment_s_applications() throws Exception {
    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    page.getByTestId("HomePageLoggedIn-admin-card-0-applications-button").click();
    Locator csvButton = page.getByTestId("RecruitmentApplicationsPage-header-download-csv");
    waitFor(csvButton);
    assertThat(csvButton).containsText("Download Applications as CSV");

    Download download = page.waitForDownload(csvButton::click);
    String firstLine = java.nio.file.Files.readAllLines(download.path()).get(0);
    org.junit.jupiter.api.Assertions.assertTrue(
        download.suggestedFilename().matches("applications-\\d+\\.csv"),
        download.suggestedFilename());
    org.junit.jupiter.api.Assertions.assertTrue(
        firstLine.startsWith("\"id\",\"submittedAt\",\"email\""), firstLine);
    org.junit.jupiter.api.Assertions.assertTrue(firstLine.contains("\"classLevel\""), firstLine);
  }

  /** Issues #234, #358: the recruitment card hands the browser the faculty rankings file. */
  @Test
  public void the_recruitment_card_downloads_the_recruitment_s_rankings() throws Exception {
    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    // The button is on the card once faculty reviews have been opened (issue #358).
    waitFor(page.getByTestId("HomePageLoggedIn-admin-card-0-courses-button"));
    org.junit.jupiter.api.Assertions.assertEquals(
        0, page.getByTestId("HomePageLoggedIn-admin-card-0-rankings-csv-button").count());
    edu.ucsb.cs.taapply.entity.Recruitment created =
        recruitmentRepository.findAll().iterator().next();
    created.setReviewStatus("Open");
    recruitmentRepository.save(created);
    goToRecruitments();
    Locator csvButton = page.getByTestId("HomePageLoggedIn-admin-card-0-rankings-csv-button");
    waitFor(csvButton);
    assertThat(csvButton).containsText("Download Rankings CSV");

    Download download = page.waitForDownload(csvButton::click);
    String firstLine = java.nio.file.Files.readAllLines(download.path()).get(0);
    org.junit.jupiter.api.Assertions.assertTrue(
        download.suggestedFilename().matches("rankings-\\d+\\.csv"), download.suggestedFilename());
    org.junit.jupiter.api.Assertions.assertTrue(
        firstLine.startsWith("\"firstName\",\"lastName\",\"email\""), firstLine);
  }

  /**
   * Issue #317: the card's button row is Courses, Draft Applications, Applications, Make
   * Assignments and View Assignments, and steps 8 and 9 of the diagram carry the same two names,
   * each to its own page: the admin page where assignments are made, and the read-only page.
   */
  @Test
  public void the_card_and_steps_8_and_9_tell_make_assignments_from_view_assignments()
      throws Exception {
    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    String card = "HomePageLoggedIn-admin-card-0-";
    waitFor(page.getByTestId(card + "courses-button"));
    Long id = recruitmentRepository.findAll().iterator().next().getId();

    // The five buttons, in order, in one footer; reviews have not started, so no CSV button.
    Locator footer = page.getByTestId(card + "courses-button").locator("..");
    assertThat(footer.getByRole(AriaRole.LINK))
        .hasText(
            new String[] {
              "Courses",
              "Draft Applications",
              "Applications",
              "Make Assignments",
              "View Assignments"
            });
    assertThat(page.getByTestId(card + "make-assignments-button"))
        .hasAttribute("href", "/admin/recruitments/" + id + "/assignments");
    assertThat(page.getByTestId(card + "view-assignments-button"))
        .hasAttribute("href", "/recruitments/" + id + "/assignments");

    // The diagram (expanded on the latest TA recruitment): step 8's title and link both open the
    // admin page; step 9's link opens the read-only page while its title, before publishing, is
    // the publish dialog.
    String steps = card + "steps-steps-step-";
    assertThat(page.getByTestId(steps + "8-link"))
        .hasAttribute("href", "/admin/recruitments/" + id + "/assignments");
    assertThat(page.getByTestId(steps + "8-link-0")).hasText("Make Assignments");
    assertThat(page.getByTestId(steps + "8-link-0"))
        .hasAttribute("href", "/admin/recruitments/" + id + "/assignments");
    assertThat(page.getByTestId(steps + "9-link-0")).hasText("View Assignments");
    assertThat(page.getByTestId(steps + "9-link-0"))
        .hasAttribute("href", "/recruitments/" + id + "/assignments");
    assertThat(page.getByTestId(steps + "9-action")).isVisible();
    org.junit.jupiter.api.Assertions.assertEquals(0, page.getByTestId(steps + "9-link").count());
    org.junit.jupiter.api.Assertions.assertEquals(0, page.getByText("(see assignments)").count());

    // Make Assignments lands on the admin assignments page.
    page.getByTestId(card + "make-assignments-button").click();
    waitFor(page.getByTestId("AdminAssignmentsPage-count"));
    assertThat(page.getByTestId("AdminAssignmentsPage-count")).isVisible();
    org.junit.jupiter.api.Assertions.assertTrue(
        page.url().endsWith("/admin/recruitments/" + id + "/assignments"), page.url());

    // View Assignments lands on the read-only page, which says they are not published yet.
    goToRecruitments();
    waitFor(page.getByTestId(card + "view-assignments-button"));
    page.getByTestId(card + "view-assignments-button").click();
    waitFor(page.getByTestId("PublishedAssignmentsPage"));
    assertThat(page.getByTestId("PublishedAssignmentsPage")).isVisible();
    org.junit.jupiter.api.Assertions.assertTrue(
        page.url().endsWith("/recruitments/" + id + "/assignments"), page.url());
    // The page's query retries the 400 a few times before it shows the error, so allow for that.
    assertThat(page.getByTestId("PublishedAssignmentsPage-error"))
        .containsText(
            "have not been published",
            new com.microsoft.playwright.assertions.LocatorAssertions.ContainsTextOptions()
                .setTimeout(30000));
  }

  /** Issue #141: the recruitments live on the admin's home page, and the old page is gone. */
  @Test
  public void non_admin_sees_no_recruitments_and_the_old_page_is_gone() throws Exception {
    setupRegularUser();
    goToRecruitments();

    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin-create-button")).not().isVisible();

    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/recruitments"));
    assertThat(page.getByText("Page Not Found")).isVisible();
  }
}
