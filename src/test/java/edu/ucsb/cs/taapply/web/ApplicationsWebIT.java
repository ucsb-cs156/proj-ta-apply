package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
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

  private void goTo(String path) {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  /** An open recruitment of the given type whose deadline is the given date. */
  private Recruitment seedRecruitment(RecruitmentType type, LocalDate primaryConsiderationDate) {
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

  private void fillAndSubmit() {
    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-major").fill("Computer Science");
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
    page.getByTestId("ApplyPage-availableForLecturesFirstChoice").check();
    page.getByTestId("ApplyPage-availabilityCommentsFirstChoice").fill("Free after 2pm.");
    page.getByTestId("ApplyPage-courseInterest-CMPSC-130A-ENTHUSIASTIC").check();
    page.getByTestId("ApplyPage-submit").click();
  }

  @Test
  public void a_grad_student_applies_and_the_application_is_listed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));
    stubSectionTimes();

    setupGradStudentUser();
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

  /** The type rule is enforced server side, so the URL is no way around it. */
  @Test
  public void an_undergrad_cannot_apply_to_a_ta_recruitment() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));

    // A UCSB address with no other role gets ROLE_UNDERGRAD.
    setupRegularUser();
    goTo("/");

    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications for ULA positions are not currently being accepted.");

    goTo("/apply/" + recruitment.getId());
    assertThat(page.getByTestId("ApplyPage-unavailable")).isVisible();
    assertThat(page.getByTestId("ApplyPage-submit")).not().isVisible();
  }

  @Test
  public void past_the_deadline_only_the_comments_can_be_changed() throws Exception {
    Recruitment recruitment = seedRecruitment(RecruitmentType.TA, LocalDate.now().plusDays(30));

    setupGradStudentUser();
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
    page.getByTestId("TestApplicationPage-major").fill("Computer Science");
    page.getByTestId("TestApplicationPage-firstChoiceCourse").selectOption("CMPSC   156");
    page.getByTestId("TestApplicationPage-submit").click();

    // Saved and shown back on the same page, still under the banner.
    assertThat(page.getByTestId("TestApplicationPage-saved")).isVisible();
    assertThat(page.getByTestId("TestApplicationPage-summary-Name")).containsText("Ada Admin");
    assertThat(page.getByTestId("TestOnlyBanner")).isVisible();
  }
}
