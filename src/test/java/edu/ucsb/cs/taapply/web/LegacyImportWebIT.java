package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.options.FilePayload;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

/** End-to-end: the legacy export is imported from TA App Settings and shows up for review. */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class LegacyImportWebIT extends WebTestCase {

  private void goTo(String path) {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
  }

  private static final String LEGACY_CSV =
      "date_modified,first_name,last_name,middle_name,email,residency_status,language_exam,"
          + "language_exam_date_passed,major,gpa_major,gpa_overall,class_level,year_in_program,"
          + "graduation_date,coursework_ucsb,coursework_other,coursework_290,knowledge,"
          + "prev_experience,desired_courses_grad,desired_courses_upper,desired_courses_lower,"
          + "comments_applicant,comments_reviewer,preferred_job,preferred_hours,date_submitted,"
          + "modified_by,application_quarter,must_hire,\n"
          + "2025-11-20 10:00:00,Ada,Lovelace,Fakedata,ada.lovelace@ucsb.edu,F1 (Student) Visa,"
          + "passed (F1 or J1 visa),Fall 2024,CS,3.9,3.8,PHD,2,06/2027,\"130A:A,16:IP\","
          + "\"Intro to C:De Anza College:16\",\"291A Scalable Internet Services:Gustaf Zeitler:A\","
          + "\"C++:3,Python:5\",\"130A:TA:Fall 2024\",,\"156,111\",\"8,16\",Happy to help.,,"
          + "TA Only,20,2025-11-01 09:00:00,admin,W26,0,\n"
          + "2025-11-21 10:00:00,Grace,Hopper,Fakedata,grace.hopper@ucsb.edu,U.S. Citizen,"
          + "exempt (U.S. Citizen),0,CS,3.7,3.6,MS,1,06/2026,\"8:A+\",,,\"Java:4\",,,\"156\",,,,"
          + "No Preference,20,2025-11-02 09:00:00,admin,W26,0,\n";

  @Test
  public void admin_imports_the_legacy_export_into_a_ta_recruitment_and_can_review_it()
      throws Exception {
    Recruitment w26 =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.CLOSED)
                .tentativeOpeningDate(LocalDate.of(2025, 11, 1))
                .primaryConsiderationDate(LocalDate.of(2025, 11, 20))
                .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(w26.getId())
            .courseId("CMPSC   156")
            .section("0100")
            .enrollCode("07492")
            .title("ADV APP PROGRAM")
            .removed(false)
            .build());

    setupAdminUser();
    goTo("/admin/settings/ta");
    assertThat(page.getByTestId("TaAppSettingsPage-legacy")).isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-button")).isDisabled();

    FilePayload csv =
        new FilePayload("legacy.csv", "text/csv", LEGACY_CSV.getBytes(StandardCharsets.UTF_8));
    page.getByTestId("TaAppSettingsPage-legacy-quarter").selectOption("20261");
    page.getByTestId("TaAppSettingsPage-legacy-file").setInputFiles(csv);
    page.getByTestId("TaAppSettingsPage-legacy-button").click();
    assertThat(
            page.getByText(
                "Import complete: 2 applications added, 0 already present, 0 rows skipped"))
        .isVisible();
    // The TA topics list was empty, so every rated topic was added to it and is reported.
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics-modal")).isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics")).containsText("C++");
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics")).containsText("Python");
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics")).containsText("Java");
    page.getByTestId("TaAppSettingsPage-legacy-added-topics-dismiss").click();
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics-modal")).not().isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-topics-table-cell-row-0-col-name"))
        .containsText("C++");

    // The same file again changes nothing, and adds no topics.
    page.getByTestId("TaAppSettingsPage-legacy-file").setInputFiles(csv);
    page.getByTestId("TaAppSettingsPage-legacy-button").click();
    assertThat(
            page.getByText(
                "Import complete: 0 applications added, 2 already present, 0 rows skipped"))
        .isVisible();
    assertThat(page.getByTestId("TaAppSettingsPage-legacy-added-topics-modal")).not().isVisible();

    // The imported applications are there to review, with the legacy answers matched in.
    goTo("/admin/recruitments/" + w26.getId() + "/applications");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-count"))
        .containsText("2 Applications Received");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-name"))
        .containsText("Lovelace");
    assertThat(page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-1-col-name"))
        .containsText("Hopper");
    page.getByTestId("RecruitmentApplicationsPage-applications-cell-row-0-col-id-link").click();
    assertThat(page.getByTestId("AdminApplicationPage-summary-Major"))
        .containsText("Computer Science");
    assertThat(page.getByTestId("AdminApplicationPage-summary-Class Level")).containsText("PhD");
    assertThat(page.getByTestId("AdminApplicationPage-adminComments"))
        .hasValue(
            "Imported from the legacy TA application; legacy quarter W26; submitted 2025-11-01"
                + " 09:00:00; last modified 2025-11-20 10:00:00.");
  }
}
