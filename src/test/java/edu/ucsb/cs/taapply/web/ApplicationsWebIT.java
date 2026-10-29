package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
 * End-to-end coverage of applying. Recruitments and their courses are seeded directly rather than
 * driven through the admin pages, since those already have their own integration test.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class ApplicationsWebIT extends WebTestCase {

  /** What the UCSB API says about CMPSC 156 in the seeded quarter: one lecture, two sections. */
  private static final String CMPSC_156_SECTIONS =
      """
      {"quarter":"20214","courseId":"CMPSC   156","title":"ADV APP PROGRAM",
       "classSections":[
         {"enrollCode":"07492","section":"0100",
          "timeLocations":[{"days":"T R","beginTime":"14:00","endTime":"15:15","building":"PHELP","room":"3526"}],
          "instructors":[{"instructor":"CONRAD P","functionCode":"Teaching and in charge"}]},
         {"enrollCode":"07500","section":"0101",
          "timeLocations":[{"days":"W","beginTime":"09:00","endTime":"09:50","building":"PHELP","room":"1401"}],
          "instructors":[{"instructor":"GAUCHO C","functionCode":"Teaching but not in charge"}]},
         {"enrollCode":"07501","section":"0102",
          "timeLocations":[{"days":"F","beginTime":"09:00","endTime":"09:50","building":"PHELP","room":"1401"}],
          "instructors":[{"instructor":"GAUCHO C","functionCode":"Teaching but not in charge"}]}
       ]}
      """;

  /** The curriculum API lives on the same WireMock as OAuth in the integration profile. */
  private static void stubSectionTimes() {
    wireMockServer.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get(
                com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                    "/academics/curriculums/v1/classes/20214/07492"))
            .willReturn(
                com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(CMPSC_156_SECTIONS)));
  }

  @Autowired TaMajorRepository taMajorRepository;
  @Autowired TaTopicRepository taTopicRepository;
  @Autowired UlaMajorRepository ulaMajorRepository;
  @Autowired UlaTopicRepository ulaTopicRepository;
  @Autowired UlaInterestRepository ulaInterestRepository;
  @Autowired NoticeVersionRepository noticeVersionRepository;
  @Autowired ApplicationRepository applicationRepository;

  /** The notice every TA applicant must agree to. */
  private NoticeVersion seedTaNotice() {
    return noticeVersionRepository.save(
        NoticeVersion.builder()
            .type(RecruitmentType.TA)
            .content("# TA Terms\n\nBe available for the **whole** quarter.")
            .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4))
            .build());
  }

  /** The admin-maintained lists the ULA form offers, and the notice its applicants agree to. */
  private void seedUlaLists() {
    noticeVersionRepository.save(
        NoticeVersion.builder()
            .type(RecruitmentType.ULA)
            .content("# ULA Terms\n\nAttend the weekly meeting.")
            .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4))
            .build());
    ulaMajorRepository.save(UlaMajor.builder().name("Computer Science").build());
    ulaTopicRepository.save(UlaTopic.builder().name("JavaScript").build());
    ulaInterestRepository.save(UlaInterest.builder().name("Grading").build());
    ulaInterestRepository.save(UlaInterest.builder().name("Tutoring").build());
  }

  /** The admin-maintained lists the TA form offers. */
  private void seedTaLists() {
    seedTaNotice();
    taMajorRepository.save(TaMajor.builder().name("Computer Science").build());
    taMajorRepository.save(TaMajor.builder().name("Statistics").build());
    taTopicRepository.save(TaTopic.builder().name("Java").build());
    taTopicRepository.save(TaTopic.builder().name("Python").build());
  }

  private void goTo(String path) {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  /**
   * An open recruitment of the given type whose deadline is the given date. Every test that chooses
   * CMPSC 156 brings up its section times, so the API answer is stubbed here too.
   */
  private Recruitment seedRecruitment(RecruitmentType type, LocalDate primaryConsiderationDate) {
    stubSectionTimes();
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20214")
                .type(type)
                .applicationStatus(ApplicationStatus.OPEN)
                .tentativeOpeningDate(LocalDate.of(2021, 9, 1))
                .primaryConsiderationDate(primaryConsiderationDate)
                .actualOpeningDate(LocalDate.of(2021, 9, 1))
                .build());

    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   156")
            .section("0100")
            .enrollCode("07492")
            .title("ADV APP PROGRAM")
            .removed(false)
            .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   130A")
            .section("0100")
            .enrollCode("07600")
            .title("DATA STRUCT")
            .removed(false)
            .build());

    return recruitment;
  }

  /** Adds one UCSB course through the coursework modal. */
  private void addCourse(String prefix, String courseNumber) {
    page.getByTestId(prefix + "-coursework-add-button").click();
    page.getByTestId(prefix + "-coursework-modal-courseNumber").fill(courseNumber);
    page.getByTestId(prefix + "-coursework-modal-save").click();
    assertThat(page.getByTestId(prefix + "-coursework-modal")).not().isVisible();
  }

  private void fillAndSubmit() {
    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-major").selectOption("Computer Science");
    page.getByTestId("ApplyPage-topic-Java-4").check();
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    page.getByTestId("ApplyPage-availableForLecturesFirstChoice").check();
    page.getByTestId("ApplyPage-availabilityCommentsFirstChoice").fill("Free after 2pm.");
    page.getByTestId("ApplyPage-courseInterest-CMPSC-130A-ENTHUSIASTIC").check();

    // A TA application needs three prior courses; the third is taken elsewhere.
    addCourse("ApplyPage", "CMPSC 130A");
    addCourse("ApplyPage", "CMPSC 130B");
    page.getByTestId("ApplyPage-coursework-add-button").click();
    page.getByTestId("ApplyPage-coursework-modal-ucsbCourse").uncheck();
    page.getByTestId("ApplyPage-coursework-modal-otherSchool").fill("De Anza College");
    page.getByTestId("ApplyPage-coursework-modal-courseNumber").fill("CIS 22A");
    page.getByTestId("ApplyPage-coursework-modal-save").click();
    assertThat(page.getByTestId("ApplyPage-coursework-count")).containsText("3 of at least 3");

    // The notice is shown, rendered from Markdown, and the submit is refused until agreed.
    assertThat(page.getByTestId("ApplyPage-notice-content").locator("h1")).containsText("TA Terms");
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-notice-agree"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-notice-agree").check();
    page.getByTestId("ApplyPage-submit").click();
  }

  @Test
  public void a_regular_user_applies_and_the_application_is_listed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/");

    Locator applyLink = page.getByTestId("HomePageLoggedIn-dashboard-apply-" + recruitment.getId());
    assertThat(applyLink).isVisible();
    applyLink.click();

    // A TA application asks the TA-only questions and none of the ULA ones.
    assertThat(page.getByTestId("ApplyPage-residencyStatus")).isVisible();
    assertThat(page.getByTestId("ApplyPage-videoLink")).not().isVisible();

    // With no earlier application to copy from, the names come from the Google account. The
    // OIDC token is the source of truth for profile fields, so these are its claims ("Test
    // User"), not whatever the test seeded into the User row.
    assertThat(page.getByTestId("ApplyPage-firstName")).hasValue("Test");
    assertThat(page.getByTestId("ApplyPage-lastName")).hasValue("User");

    // Every course in the recruitment is asked about, defaulting to not interested.
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-130A-NOT_INTERESTED")).isChecked();
    assertThat(page.getByTestId("ApplyPage-courseInterest-CMPSC-156-NOT_INTERESTED")).isChecked();

    // Choosing a course brings up when it meets, looked up live, between the dropdown and the
    // availability questions; it can be folded away.
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections")).not().isVisible();
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-title"))
        .containsText("ADV APP PROGRAM");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type"))
        .containsText("Lecture");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-time"))
        .containsText("14:00 - 15:15");
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-2-section"))
        .containsText("0102");
    page.getByTestId("ApplyPage-firstChoiceSections-toggle").click();
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type")).not().isVisible();
    page.getByTestId("ApplyPage-firstChoiceSections-toggle").click();
    assertThat(page.getByTestId("ApplyPage-firstChoiceSections-row-0-type")).isVisible();

    fillAndSubmit();

    // Back on the home page, listed as pending, with the link now saying they have applied.
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-status"))
        .containsText("PENDING");
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-applied-" + recruitment.getId()))
        .isVisible();
    assertThat(applyLink).not().isVisible();

    // And it opens for editing, with the answers that were given.
    page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-action-link").click();
    assertThat(page.getByTestId("ApplicationPage-status")).containsText("PENDING");
    assertThat(page.getByTestId("ApplicationPage-firstName")).hasValue("Chris");
    assertThat(page.getByTestId("ApplicationPage-major")).hasValue("Computer Science");
    assertThat(page.getByTestId("ApplicationPage-topic-Java-4")).isChecked();
    // The courses came back with the application, in order, with the school shown.
    assertThat(page.getByTestId("ApplicationPage-coursework-table-cell-row-2-col-school"))
        .containsText("De Anza College");
    // The version agreed to is shown back, already ticked.
    assertThat(page.getByTestId("ApplicationPage-notice-agree")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-notice-version")).containsText("Version 1");
    assertThat(page.getByTestId("ApplicationPage-firstChoiceCourse")).hasValue("CMPSC   156");
    // The first choice row says so instead of offering options; the other answer came back.
    assertThat(page.getByTestId("ApplicationPage-courseInterest-CMPSC-156-choice"))
        .containsText("1st choice");
    assertThat(page.getByTestId("ApplicationPage-courseInterest-CMPSC-130A-ENTHUSIASTIC"))
        .isChecked();
    assertThat(page.getByTestId("ApplicationPage-availabilityCommentsFirstChoice"))
        .hasValue("Free after 2pm.");
    // The stored choice's times come up again while editing.
    assertThat(page.getByTestId("ApplicationPage-firstChoiceSections-row-0-type"))
        .containsText("Lecture");

    page.getByTestId("ApplicationPage-lastName").fill("Gaucho-Smith");
    page.getByTestId("ApplicationPage-submit").click();

    page.reload();
    assertThat(page.getByTestId("ApplicationPage-lastName")).hasValue("Gaucho-Smith");
  }

  /** Any signed-in user sees every open recruitment, each labelled with its type. */
  @Test
  public void a_regular_user_sees_open_recruitments_of_both_types() throws Exception {
    Recruitment ta = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    Recruitment ula = seedRecruitment(RecruitmentType.ULA, LocalDate.now().plusDays(30));

    setupRegularUser();
    goTo("/");

    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-open-" + ta.getId()))
        .containsText("Applications for TA positions");
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-open-" + ula.getId()))
        .containsText("Applications for ULA positions");
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-apply-" + ta.getId())).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-apply-" + ula.getId())).isVisible();
  }

  /** The ULA form rates topics on three levels and adds an Interests table rated 1 to 5. */
  @Test
  public void a_ula_application_asks_a_three_point_topic_scale_and_interests() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.ULA, LocalDate.now().plusDays(30));
    seedUlaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());

    // The topic table's headings are the worded three-point scale, and there is no 4 or 5.
    assertThat(page.getByTestId("ApplyPage-topicProficiencies")).containsText("1-Very comfortable");
    assertThat(page.getByTestId("ApplyPage-topicProficiencies")).containsText("3-Not familiar");
    assertThat(page.getByTestId("ApplyPage-topic-JavaScript-3")).isVisible();
    assertThat(page.getByTestId("ApplyPage-topic-JavaScript-4")).not().isVisible();
    // The interests table lists the admin's areas with a 1 to 5 scale.
    assertThat(page.getByTestId("ApplyPage-interests")).containsText("1-Not interested");
    assertThat(page.getByTestId("ApplyPage-interests")).containsText("5-Very interested");

    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-major").selectOption("Computer Science");
    page.getByTestId("ApplyPage-topic-JavaScript-2").check();
    page.getByTestId("ApplyPage-interest-Tutoring-5").check();
    page.getByTestId("ApplyPage-interest-Grading-1").check();
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    addCourse("ApplyPage", "CMPSC 16");
    page.getByTestId("ApplyPage-notice-agree").check();

    // The questions from the ULA Google Form (issue #72). The perm number is required and
    // checked; the follow-up questions appear as the earlier answers call for them.
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-permNumber"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-permNumber").fill("12-4567");
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-permNumber"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-permNumber").fill("a1b2c3d");
    assertThat(page.getByTestId("ApplyPage-studentStatusNextQuarter")).not().isVisible();
    page.getByTestId("ApplyPage-bsMsStudent").selectOption("true");
    page.getByTestId("ApplyPage-studentStatusNextQuarter").selectOption("GRADUATE");
    assertThat(page.getByTestId("ApplyPage-graduate-warning"))
        .containsText("strongly encouraged to apply to be a TA instead");
    page.getByTestId("ApplyPage-wantsTaEligibility").selectOption("true");
    page.getByTestId("ApplyPage-otherCampusJob").selectOption("NOT_SURE");
    assertThat(page.getByTestId("ApplyPage-employeeId")).not().isVisible();
    page.getByTestId("ApplyPage-priorUcsbEmployment").selectOption("true");
    page.getByTestId("ApplyPage-employeeId").fill("1234567");
    page.getByTestId("ApplyPage-i9Appointment").selectOption("false");
    assertThat(page.getByTestId("ApplyPage-training")).not().isVisible();
    page.getByTestId("ApplyPage-previousServiceAsUla").fill("0");
    assertThat(page.getByTestId("ApplyPage-training-statement"))
        .containsText("five mandatory training sessions");
    page.getByTestId("ApplyPage-trainingCommitment").selectOption("UNSURE");
    page.getByTestId("ApplyPage-trainingCommitmentExplanation").fill("Might have a Friday lab");
    page.getByTestId("ApplyPage-changingMajor").selectOption("false");
    page.getByTestId("ApplyPage-submit").click();

    // Listed on the home page, and the answers come back when it is opened for editing.
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-type"))
        .containsText("ULA");
    page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-action-link").click();
    assertThat(page.getByTestId("ApplicationPage-topic-JavaScript-2")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-interest-Tutoring-5")).isChecked();
    assertThat(page.getByTestId("ApplicationPage-interest-Grading-1")).isChecked();
    // Stored upper case; the follow-ups come back with the answers that reveal them.
    assertThat(page.getByTestId("ApplicationPage-permNumber")).hasValue("A1B2C3D");
    assertThat(page.getByTestId("ApplicationPage-bsMsStudent")).hasValue("true");
    assertThat(page.getByTestId("ApplicationPage-studentStatusNextQuarter")).hasValue("GRADUATE");
    assertThat(page.getByTestId("ApplicationPage-graduate-warning")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-employeeId")).hasValue("1234567");
    assertThat(page.getByTestId("ApplicationPage-trainingCommitment")).hasValue("UNSURE");
    assertThat(page.getByTestId("ApplicationPage-trainingCommitmentExplanation"))
        .hasValue("Might have a Friday lab");
  }

  @Test
  public void past_the_deadline_only_the_comments_can_be_changed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    seedTaLists();

    setupRegularUser();
    goTo("/apply/" + recruitment.getId());
    fillAndSubmit();

    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-status"))
        .containsText("PENDING");

    // Move the deadline into the past, which is what an admin editing the recruitment would do.
    Recruitment stored = recruitmentRepository.findById(recruitment.getId()).orElseThrow();
    stored.setPrimaryConsiderationDate(LocalDate.now().minusDays(1));
    recruitmentRepository.save(stored);

    page.reload();
    page.getByTestId("HomePageLoggedIn-dashboard-applications-cell-row-0-col-action-link").click();

    assertThat(page.getByTestId("ApplicationPage-comments-only")).isVisible();
    assertThat(page.getByTestId("ApplicationPage-firstName")).not().isVisible();
    // The answers are still shown back, just not as a form.
    assertThat(page.getByTestId("ApplicationPage-summary-Major")).containsText("Computer Science");
    assertThat(page.getByTestId("ApplicationPage-summary-Other Courses of Interest"))
        .containsText("CMPSC   130A  Enthusiastic");
    assertThat(page.getByTestId("ApplicationPage-summary-First Choice Availability Comments"))
        .containsText("Free after 2pm.");

    page.getByTestId("ApplicationPage-postApplicationComments").fill("Finished CS 290A since.");
    page.getByTestId("ApplicationPage-submit").click();

    page.reload();
    assertThat(page.getByTestId("ApplicationPage-postApplicationComments"))
        .hasValue("Finished CS 290A since.");
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
            .firstChoiceCourse("CMPSC   156")
            .build());

    setupAdminUser();
    goTo("/admin/recruitments");
    page.getByTestId("RecruitmentsIndexPage-cell-row-0-col-review-button").click();

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
  }

  /** An admin previews the form from the recruitments table; the result is flagged as a test. */
  @Test
  public void an_admin_can_enter_a_test_application_from_the_recruitments_table() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    // Closed: the preview has to work before applications open.
    recruitment.setApplicationStatus(ApplicationStatus.CLOSED);
    recruitmentRepository.save(recruitment);

    setupAdminUser();
    goTo("/admin/recruitments");

    page.getByTestId("RecruitmentsIndexPage-cell-row-0-col-test-button").click();

    // The warning sits above the form, and the form is the TA one.
    assertThat(page.getByTestId("TestOnlyBanner")).containsText("This is a test only");
    assertThat(page.getByTestId("TestApplicationPage-residencyStatus")).isVisible();
    assertThat(page.getByTestId("TestApplicationPage-saved")).not().isVisible();

    page.getByTestId("TestApplicationPage-firstName").fill("Ada");
    page.getByTestId("TestApplicationPage-lastName").fill("Admin");
    // Not on the list: Other, then the text.
    page.getByTestId("TestApplicationPage-major").selectOption("__OTHER__");
    page.getByTestId("TestApplicationPage-otherMajor").fill("Computer Science");
    page.getByTestId("TestApplicationPage-firstChoiceCourse").selectOption("CMPSC   156");
    addCourse("TestApplicationPage", "CMPSC 8");
    addCourse("TestApplicationPage", "CMPSC 16");
    addCourse("TestApplicationPage", "CMPSC 24");
    page.getByTestId("TestApplicationPage-submit").click();

    // Saved and shown back on the same page, still under the banner.
    assertThat(page.getByTestId("TestApplicationPage-saved")).isVisible();
    assertThat(page.getByTestId("TestApplicationPage-summary-Name")).containsText("Ada Admin");
    assertThat(page.getByTestId("TestOnlyBanner")).isVisible();
  }
}
