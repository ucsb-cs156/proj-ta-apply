package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
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
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/**
 * Shared setup of the end-to-end tests of applying ({@code Applications*WebIT}): the seeded
 * recruitment and quarter, the admin-maintained lists and notices the forms offer, and filling in
 * the TA form. Recruitments and their courses are seeded directly rather than driven through the
 * admin pages, since those already have their own integration test.
 *
 * <p>These tests were one class, {@code ApplicationsWebIT}, until issue #361 split it along feature
 * lines so the CI shards could be balanced: {@link ApplicationsApplyWebIT} (filling in and
 * submitting the form), {@link ApplicationsDraftsWebIT} (drafts and editing one in two windows) and
 * {@link ApplicationsSubmittedWebIT} (what happens to an application once it is submitted). This
 * class is abstract and does not end in {@code WebIT}, so failsafe and the shard assignment ignore
 * it; the Spring and JUnit annotations below are inherited by the three.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public abstract class ApplicationsWebTestCase extends WebTestCase {

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

  @Autowired protected TaMajorRepository taMajorRepository;
  @Autowired protected TaTopicRepository taTopicRepository;
  @Autowired protected UlaMajorRepository ulaMajorRepository;
  @Autowired protected UlaTopicRepository ulaTopicRepository;
  @Autowired protected UlaInterestRepository ulaInterestRepository;
  @Autowired protected NoticeVersionRepository noticeVersionRepository;

  @Autowired
  protected edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository ucsbApiQuarterRepository;

  @Autowired protected ApplicationRepository applicationRepository;
  @Autowired protected DraftApplicationRepository draftApplicationRepository;

  /** The notice every TA applicant must agree to. */
  protected NoticeVersion seedTaNotice() {
    return noticeVersionRepository.save(
        NoticeVersion.builder()
            .type(RecruitmentType.TA)
            // Issue #150: the two fields, filled in from the recruitment when shown.
            .content(
                "# TA Terms\n\nBe available for the **whole** quarter.\n\nApply for ${quarter}"
                    + " by ${primaryConsiderationDate}. Classes begin ${firstDayOfClasses}.")
            .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4))
            .build());
  }

  /** The admin-maintained lists the ULA form offers, and the notice its applicants agree to. */
  protected void seedUlaLists() {
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
  protected void seedTaLists() {
    seedTaNotice();
    taMajorRepository.save(TaMajor.builder().name("Computer Science").build());
    taMajorRepository.save(TaMajor.builder().name("Statistics").build());
    taTopicRepository.save(TaTopic.builder().name("Java").build());
    taTopicRepository.save(TaTopic.builder().name("Python").build());
  }

  protected void goTo(String path) {
    openPage(page, path);
  }

  /**
   * An open recruitment of the given type whose deadline is the given date. Every test that chooses
   * CMPSC 156 brings up its section times, so the API answer is stubbed here too.
   */
  protected Recruitment seedRecruitment(RecruitmentType type, LocalDate primaryConsiderationDate) {
    stubSectionTimes();
    // Issue #153: the quarter calendar's row for the recruitment's quarter.
    ucsbApiQuarterRepository.save(
        edu.ucsb.cs.taapply.entity.UCSBAPIQuarter.builder()
            .quarter("20214")
            .qyy("F21")
            .name("FALL 2021")
            .firstDayOfClasses(LocalDateTime.of(2021, 10, 1, 0, 0))
            .build());
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
  protected void addCourse(String prefix, String courseNumber) {
    page.getByTestId(prefix + "-coursework-add-button").click();
    page.getByTestId(prefix + "-coursework-modal-courseNumber").fill(courseNumber);
    page.getByTestId(prefix + "-coursework-modal-save").click();
    assertThat(page.getByTestId(prefix + "-coursework-modal")).not().isVisible();
  }

  protected void fillAndSubmit() {
    fillAndSubmit(false);
  }

  /**
   * Fills the TA form and submits it. With {@code firstQuarter}, the GPAs are typed first and the
   * first quarter box (issue #292) ticked afterwards, so the typed values have to be dropped.
   */
  protected void fillAndSubmit(boolean firstQuarter) {
    page.getByTestId("ApplyPage-firstName").fill("Chris");
    page.getByTestId("ApplyPage-lastName").fill("Gaucho");
    page.getByTestId("ApplyPage-major").selectOption("Computer Science");
    // The TA answers required since issue #214.
    page.getByTestId("ApplyPage-gpaMajor").fill("3.9");
    page.getByTestId("ApplyPage-gpaOverall").fill("3.8");
    if (firstQuarter) {
      page.getByTestId("ApplyPage-firstQuarter").check();
    }
    page.getByTestId("ApplyPage-yearInProgram").fill("2nd");
    page.getByTestId("ApplyPage-graduationDate").fill("S27");
    page.getByTestId("ApplyPage-classLevel").selectOption("PHD");
    page.getByTestId("ApplyPage-residencyStatus").selectOption("US_CITIZEN");
    page.getByTestId("ApplyPage-languageExam").selectOption("EXEMPT_US_CITIZEN");
    page.getByTestId("ApplyPage-topic-Java-4").check();
    page.getByTestId("ApplyPage-firstChoiceCourse").selectOption("CMPSC   156");
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
    // Issue #150: the fields read as the recruitment's quarter and deadline, not as written.
    assertThat(page.getByTestId("ApplyPage-notice-content")).containsText("Apply for Fall 2021 by");
    // Issue #153: a quarter calendar field, from the row the admin's Quarters page keeps on file.
    assertThat(page.getByTestId("ApplyPage-notice-content"))
        .containsText("Classes begin October 1, 2021.");
    assertThat(page.getByTestId("ApplyPage-notice-content")).not().containsText("${");
    page.getByTestId("ApplyPage-submit").click();
    assertThat(page.getByTestId("ApplyPage-notice-agree"))
        .hasClass(java.util.regex.Pattern.compile("is-invalid"));
    page.getByTestId("ApplyPage-notice-agree").check();
    page.getByTestId("ApplyPage-submit").click();
  }
}
