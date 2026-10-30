package edu.ucsb.cs.taapply.web;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Download;
import com.microsoft.playwright.Locator;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Course;
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

  private void goToRecruitments() {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/recruitments"));
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
    page.getByTestId("RecruitmentsIndexPage-create-button").click();
    page.getByTestId("RecruitmentForm-tentativeOpeningDate").fill("2026-01-05");
    page.getByTestId("RecruitmentForm-primaryConsiderationDate").fill("2026-01-20");
    page.getByTestId("RecruitmentForm-submit").click();
  }

  private void waitFor(Locator locator) {
    for (int i = 0; i < 20 && !locator.isVisible(); i++) {
      page.waitForTimeout(500);
      page.reload();
    }
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

    Locator firstRow = page.getByTestId("RecruitmentsIndexPage-card-0-quarter");
    waitFor(firstRow);
    assertThat(firstRow).isVisible();

    page.getByTestId("RecruitmentsIndexPage-card-0-courses-button").click();

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

    Locator firstRow = page.getByTestId("RecruitmentsIndexPage-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("RecruitmentsIndexPage-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
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

  @Test
  public void a_removed_course_stays_hidden_until_the_toggle_reveals_it() throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());

    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator firstRow = page.getByTestId("RecruitmentsIndexPage-card-0-quarter");
    waitFor(firstRow);
    page.getByTestId("RecruitmentsIndexPage-card-0-courses-button").click();

    Locator firstCourse = page.getByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    waitFor(firstCourse);

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

    Locator statusButton = page.getByTestId("RecruitmentsIndexPage-card-0-status-button");
    waitFor(statusButton);

    assertThat(statusButton).containsText("Open");
    statusButton.click();

    assertThat(page.getByTestId("RecruitmentsIndexPage-card-0-status-button"))
        .containsText("Close");
    assertThat(page.getByTestId("RecruitmentsIndexPage-card-0-actualOpeningDate")).not().isEmpty();
  }

  /** The CSV button hands the browser a file named after the recruitment, with the TA columns. */
  @Test
  public void the_csv_button_downloads_the_recruitment_s_applications() throws Exception {
    stubOfferings();
    setupAdminUser();
    goToRecruitments();
    createTaRecruitment();

    Locator csvButton = page.getByTestId("RecruitmentsIndexPage-card-0-csv-button");
    waitFor(csvButton);
    assertThat(csvButton).containsText("CSV");

    Download download = page.waitForDownload(csvButton::click);
    String firstLine = java.nio.file.Files.readAllLines(download.path()).get(0);
    assertThat(page.getByTestId("RecruitmentsIndexPage-card-0-type")).containsText("TA");
    org.junit.jupiter.api.Assertions.assertTrue(
        download.suggestedFilename().matches("applications-\\d+\\.csv"),
        download.suggestedFilename());
    org.junit.jupiter.api.Assertions.assertTrue(
        firstLine.startsWith("\"id\",\"submittedAt\",\"email\""), firstLine);
    org.junit.jupiter.api.Assertions.assertTrue(firstLine.contains("\"classLevel\""), firstLine);
  }

  @Test
  public void non_admin_is_denied_the_recruitments_page() throws Exception {
    setupRegularUser();
    goToRecruitments();

    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }
}
