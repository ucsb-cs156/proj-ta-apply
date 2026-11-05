package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs.taapply.services.wiremock.WiremockServiceImpl;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.function.BooleanSupplier;
import java.util.stream.Collectors;
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
 * Issues #323 and #324: entering and editing prior courses, in the browser, for every kind of
 * editor. The four edits (add a course, change a grade, change a term, delete a course) are made on
 * four paths (a new draft, a saved draft, a submitted application as its owner, and one as an
 * admin) for TA and ULA, 4 x 4 x 2 = 32 cases, plus the admin's audit trail. (An admin cannot edit
 * a draft: the admin pages only read them, so the fifth path of the issue's matrix does not exist.)
 *
 * <p>To keep the run short each recruitment type is one test with one student login and one admin
 * login, and the answers are seeded rather than typed. What is saved is read back from the database
 * after every edit.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class PriorCourseworkMatrixWebIT extends WebTestCase {

  private static final String STUDENT = "cgaucho@ucsb.edu";
  private static final String NEW_COURSE = "CMPSC 190";

  @Autowired NoticeVersionRepository noticeVersionRepository;
  @Autowired TaMajorRepository taMajorRepository;
  @Autowired TaTopicRepository taTopicRepository;
  @Autowired UlaMajorRepository ulaMajorRepository;
  @Autowired UlaTopicRepository ulaTopicRepository;
  @Autowired UlaInterestRepository ulaInterestRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired DraftApplicationRepository draftApplicationRepository;
  @Autowired AuditTrailRepository auditTrailRepository;
  @Autowired FakeApplicationGenerator fakeApplicationGenerator;
  @Autowired UCSBAPIQuarterRepository ucsbApiQuarterRepository;
  @Autowired UserRepository matrixUserRepository;
  @Autowired AdminRepository matrixAdminRepository;

  private NoticeVersion seedLists(RecruitmentType type) {
    if (type == RecruitmentType.TA) {
      taMajorRepository.save(TaMajor.builder().name("Computer Science").build());
      taTopicRepository.save(TaTopic.builder().name("Java").build());
      taTopicRepository.save(TaTopic.builder().name("Python").build());
    } else {
      ulaMajorRepository.save(UlaMajor.builder().name("Computer Science").build());
      ulaTopicRepository.save(UlaTopic.builder().name("JavaScript").build());
      ulaInterestRepository.save(UlaInterest.builder().name("Grading").build());
    }
    return noticeVersionRepository.save(
        NoticeVersion.builder()
            .type(type)
            .content("# Terms\n\nBe available.")
            .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4))
            .build());
  }

  private Recruitment seedRecruitment(RecruitmentType type, String quarter) {
    // The pages read the quarter's calendar row; two recruitments of a type need two quarters.
    if (ucsbApiQuarterRepository.findById(quarter).isEmpty()) {
      ucsbApiQuarterRepository.save(
          UCSBAPIQuarter.builder()
              .quarter(quarter)
              .qyy(quarter.equals("20214") ? "F21" : "M21")
              .name(quarter.equals("20214") ? "FALL 2021" : "SUMMER 2021")
              .firstDayOfClasses(LocalDateTime.of(2021, 10, 1, 0, 0))
              .build());
    }
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter(quarter)
                .type(type)
                .applicationStatus(ApplicationStatus.OPEN)
                .tentativeOpeningDate(LocalDate.of(2021, 9, 1))
                .primaryConsiderationDate(LocalDate.now().plusDays(30))
                .actualOpeningDate(LocalDate.of(2021, 9, 1))
                .build());
    for (String[] course : new String[][] {{"CMPSC   156", "0100"}, {"CMPSC   130A", "0100"}}) {
      recruitmentCourseRepository.save(
          RecruitmentCourse.builder()
              .recruitmentId(recruitment.getId())
              .courseId(course[0])
              .section(course[1])
              .enrollCode("0" + course[0].trim().hashCode() % 10000)
              .title("A COURSE")
              .removed(false)
              .build());
    }
    return recruitment;
  }

  /** A complete application, as the fake data job would make one, owned by the student. */
  private Application seedSubmitted(Recruitment recruitment, NoticeVersion notice) {
    Application application =
        fakeApplicationGenerator
            .generate(
                recruitment,
                List.of("CMPSC   156", "CMPSC   130A"),
                1,
                FakeCoverage.ALL,
                new Random(5),
                new HashSet<>(),
                LocalDate.now())
            .get(0);
    application.setEmail(STUDENT);
    application.setRecruitmentId(recruitment.getId());
    application.setNoticeVersionId(notice.getId());
    application.setStatus(ApplicationReviewStatus.PENDING);
    return applicationRepository.save(application);
  }

  private void goTo(Page p, String path) {
    p.navigate(p.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  /** What the database holds, for the message of a failure. */
  private String stored() {
    StringBuilder text = new StringBuilder();
    draftApplicationRepository
        .findAll()
        .forEach(
            d ->
                text.append(" draft ")
                    .append(d.getRecruitmentId())
                    .append(" v")
                    .append(d.getVersion())
                    .append(": ")
                    .append(summary(d.getPriorCoursework()))
                    .append(";"));
    applicationRepository
        .findAll()
        .forEach(
            a ->
                text.append(" application ")
                    .append(a.getId())
                    .append(": ")
                    .append(summary(a.getPriorCoursework()))
                    .append(";"));
    return text.toString();
  }

  private void eventually(String what, BooleanSupplier condition) {
    for (int i = 0; i < 100; i++) {
      if (condition.getAsBoolean()) {
        return;
      }
      try {
        Thread.sleep(100);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    throw new AssertionError("Never happened: " + what + ". Stored:" + stored());
  }

  // ---- the four edits, through the coursework section of whichever page ----

  private static void add(Page p, String prefix) {
    p.getByTestId(prefix + "-coursework-add-button").click();
    p.getByTestId(prefix + "-coursework-modal-courseNumber").fill(NEW_COURSE);
    p.getByTestId(prefix + "-coursework-modal-grade").fill("A");
    p.getByTestId(prefix + "-coursework-modal-save").click();
    assertThat(p.getByTestId(prefix + "-coursework-modal")).not().isVisible();
  }

  private static void changeGrade(Page p, String prefix, int row, String grade) {
    p.getByTestId(prefix + "-coursework-table-cell-row-" + row + "-col-edit-button").click();
    p.getByTestId(prefix + "-coursework-modal-grade").fill(grade);
    p.getByTestId(prefix + "-coursework-modal-save").click();
    assertThat(p.getByTestId(prefix + "-coursework-modal")).not().isVisible();
  }

  private static void changeTerm(Page p, String prefix, int row, String term) {
    p.getByTestId(prefix + "-coursework-table-cell-row-" + row + "-col-edit-button").click();
    p.getByTestId(prefix + "-coursework-modal-freeText").check();
    p.getByTestId(prefix + "-coursework-modal-termText").fill(term);
    p.getByTestId(prefix + "-coursework-modal-save").click();
    assertThat(p.getByTestId(prefix + "-coursework-modal")).not().isVisible();
  }

  private static void delete(Page p, String prefix, int row) {
    p.getByTestId(prefix + "-coursework-table-cell-row-" + row + "-col-delete-button").click();
  }

  private static String summary(List<PriorCoursework> rows) {
    return rows.stream()
        .map(c -> c.getCourseNumber() + "|" + c.getTerm() + "|" + c.getGrade())
        .collect(Collectors.joining(", "));
  }

  // ---- what is stored ----

  private List<PriorCoursework> draftRows(Long recruitmentId) {
    return draftApplicationRepository
        .findByEmailAndRecruitmentId(STUDENT, recruitmentId)
        .orElseThrow()
        .getPriorCoursework();
  }

  private List<PriorCoursework> applicationRows(Long id) {
    return applicationRepository.findById(id).orElseThrow().getPriorCoursework();
  }

  // ---- the paths ----

  /** One edit on a draft: made, saved with Save Draft, read back, and the draft reopened. */
  private void draftEdits(Page p, Recruitment recruitment, boolean firstSession) {
    String prefix = "ApplyPage";
    Long id = recruitment.getId();
    String path = "/apply/" + id;
    String where = (firstSession ? "new draft " : "saved draft ") + recruitment.getType();

    goTo(p, path);
    assertThat(p.getByTestId(prefix + "-saveDraft")).isVisible();
    // What the form shows: a new draft is only saved once something changes, and it may start with
    // the courses carried over from an earlier application.
    int before =
        Integer.parseInt(
            p.getByTestId(prefix + "-coursework-count").innerText().trim().split(" ")[0]);

    if (firstSession) {
      // A brand new draft: everything is done in one sitting and saved once.
      add(p, prefix);
      add(p, prefix);
      changeGrade(p, prefix, 0, "B+");
      changeTerm(p, prefix, 1, "Semester 1");
      delete(p, prefix, 0);
      p.getByTestId(prefix + "-saveDraft").click();
      // Two added, one deleted. (The new draft starts with the courses of the student's earlier
      // application, which is the carry-over feature, so the count is relative.)
      eventually(where + " saved", () -> draftRows(id).size() == before + 1);
      List<PriorCoursework> rows = draftRows(id);
      assertEquals(NEW_COURSE, rows.get(rows.size() - 1).getCourseNumber(), where);
      assertEquals("A", rows.get(rows.size() - 1).getGrade(), where);
      assertEquals(
          1,
          rows.stream().filter(c -> "Semester 1".equals(c.getTerm())).count(),
          where + " the changed term");
      return;
    }

    // A saved draft: each edit on its own, saved and read back.
    add(p, prefix);
    p.getByTestId(prefix + "-saveDraft").click();
    eventually(where + " add", () -> draftRows(id).size() == before + 1);
    assertEquals(NEW_COURSE, draftRows(id).get(before).getCourseNumber(), where + " add");

    goTo(p, path);
    changeGrade(p, prefix, 0, "B+");
    p.getByTestId(prefix + "-saveDraft").click();
    eventually(where + " grade", () -> "B+".equals(draftRows(id).get(0).getGrade()));
    assertEquals(before + 1, draftRows(id).size(), where + " grade");

    goTo(p, path);
    changeTerm(p, prefix, 0, "Semester 1");
    p.getByTestId(prefix + "-saveDraft").click();
    eventually(where + " term", () -> "Semester 1".equals(draftRows(id).get(0).getTerm()));
    assertEquals("B+", draftRows(id).get(0).getGrade(), where + " term kept the grade");

    goTo(p, path);
    // The new draft's session left two of the added course, and this one a third.
    long had = draftRows(id).stream().filter(c -> NEW_COURSE.equals(c.getCourseNumber())).count();
    delete(p, prefix, before);
    p.getByTestId(prefix + "-saveDraft").click();
    eventually(where + " delete", () -> draftRows(id).size() == before);
    assertEquals(
        had - 1,
        draftRows(id).stream().filter(c -> NEW_COURSE.equals(c.getCourseNumber())).count(),
        where + " delete");
  }

  /**
   * The edits of a submitted application, one at a time, each saved with the page's submit button
   * and read back. {@code audited} also checks the audit trail row by row.
   */
  private void submittedEdits(
      Page p,
      Application application,
      String prefix,
      String submitId,
      String editPath,
      boolean audited,
      String grade,
      String term) {
    Long id = application.getId();
    String where = (audited ? "admin " : "owner ") + application.getRecruitmentId();
    int before = applicationRows(id).size();

    goTo(p, editPath);
    add(p, prefix);
    p.getByTestId(submitId).click();
    eventually(where + " add", () -> applicationRows(id).size() == before + 1);
    assertEquals(NEW_COURSE, applicationRows(id).get(before).getCourseNumber(), where + " add");
    int audit = auditCount(id);
    if (audited) {
      assertEquals(1, audit, where + " add is one audit row");
    }

    goTo(p, editPath);
    changeGrade(p, prefix, 0, grade);
    p.getByTestId(submitId).click();
    eventually(where + " grade", () -> grade.equals(applicationRows(id).get(0).getGrade()));
    assertEquals(before + 1, applicationRows(id).size(), where + " grade");
    if (audited) {
      eventually(where + " grade audit", () -> auditCount(id) == audit + 2);
      List<AuditTrail> rows = auditRows(id);
      AuditTrail added = rows.get(rows.size() - 1);
      AuditTrail gone = rows.get(rows.size() - 2);
      assertTrue(
          added.getOldValue() == null
              && added.getNewValue().contains("\"grade\":\"" + grade + "\""));
      assertTrue(
          gone.getNewValue() == null
              && !gone.getOldValue().contains("\"grade\":\"" + grade + "\""));
    }

    goTo(p, editPath);
    changeTerm(p, prefix, 0, term);
    p.getByTestId(submitId).click();
    eventually(where + " term", () -> term.equals(applicationRows(id).get(0).getTerm()));
    assertEquals(grade, applicationRows(id).get(0).getGrade(), where + " term kept the grade");
    if (audited) {
      eventually(where + " term audit", () -> auditCount(id) == audit + 4);
      List<AuditTrail> rows = auditRows(id);
      assertTrue(rows.get(rows.size() - 1).getNewValue().contains("\"term\":\"" + term + "\""));
    }

    goTo(p, editPath);
    delete(p, prefix, before);
    p.getByTestId(submitId).click();
    eventually(where + " delete", () -> applicationRows(id).size() == before);
    assertFalse(summary(applicationRows(id)).contains(NEW_COURSE), where + " delete");
    if (audited) {
      eventually(where + " delete audit", () -> auditCount(id) == audit + 5);
      List<AuditTrail> rows = auditRows(id);
      assertTrue(rows.get(rows.size() - 1).getOldValue().contains(NEW_COURSE));
      assertEquals(null, rows.get(rows.size() - 1).getNewValue());
    }
  }

  private List<AuditTrail> auditRows(Long id) {
    List<AuditTrail> rows = new java.util.ArrayList<>();
    rows.addAll(auditTrailRepository.findByTaApplicationIdOrderByIdAsc(id));
    rows.addAll(auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(id));
    return rows.stream().filter(r -> "priorCoursework".equals(r.getFieldName())).toList();
  }

  private int auditCount(Long id) {
    return auditRows(id).size();
  }

  private Page signInAsAdmin() {
    if (matrixUserRepository.findByEmail("admin@ucsb.edu").isEmpty()) {
      matrixUserRepository.save(
          User.builder()
              .email("admin@ucsb.edu")
              .familyName("Admin")
              .givenName("Ada")
              .fullName("Ada Admin")
              .googleSub("987654321")
              .pictureUrl("")
              .build());
      matrixAdminRepository.save(Admin.builder().email("admin@ucsb.edu").build());
    }
    WiremockServiceImpl.setupOauthMocks(wireMockServer, "admin@ucsb.edu");
    String base = page.url().replaceAll("(http://localhost:\\d+).*", "$1");
    BrowserContext adminContext = browser.newContext();
    Page adminPage = adminContext.newPage();
    adminPage.navigate(base + "/oauth2/authorization/my-oauth-provider");
    adminPage.locator("#username").fill("admin@ucsb.edu");
    adminPage.locator("#password").fill("password");
    adminPage.locator("#submit").click();
    return adminPage;
  }

  private void run(RecruitmentType type) {
    NoticeVersion notice = seedLists(type);
    Recruitment forDrafts = seedRecruitment(type, "20214");
    Recruitment forApplication = seedRecruitment(type, "20213");
    Application application = seedSubmitted(forApplication, notice);

    setupRegularUser();
    goTo(page, "/");

    draftEdits(page, forDrafts, true);
    draftEdits(page, forDrafts, false);
    submittedEdits(
        page,
        application,
        "ApplicationPage",
        "ApplicationPage-submit",
        "/applications/" + application.getId(),
        false,
        "B+",
        "Semester 1");

    // The student's window leaves the application, or the admin's page would be covered by the
    // warning that the applicant has it open too (issue #302).
    goTo(page, "/");
    Page admin = signInAsAdmin();
    submittedEdits(
        admin,
        application,
        "AdminApplicationEditPage",
        "AdminApplicationEditPage-submit",
        "/admin/applications/" + application.getId() + "/edit",
        true,
        "C-",
        "Semester 2");
  }

  @Test
  public void every_prior_coursework_edit_works_on_every_path_for_a_ta_application() {
    run(RecruitmentType.TA);
  }

  @Test
  public void every_prior_coursework_edit_works_on_every_path_for_a_ula_application() {
    run(RecruitmentType.ULA);
  }
}
