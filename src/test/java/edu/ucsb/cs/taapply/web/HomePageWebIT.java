package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.time.LocalDate;
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
 * Verifies that a logged-in user sees the home page, and that it reflects the roles they actually
 * hold.
 *
 * <p>Prerequisites: the frontend must be built ({@code npm run build} inside {@code frontend/}) so
 * that {@code target/classes/public/index.html} exists. Run with:
 *
 * <pre>
 * INTEGRATION=true mvn -ntp -B test-compile failsafe:integration-test failsafe:verify
 * </pre>
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class HomePageWebIT extends WebTestCase {

  @Autowired CatalogNameRepository catalogNameRepository;
  @Autowired InstructorRepository instructors;

  @Test
  public void logged_in_regular_user_sees_only_the_student_section() throws Exception {
    setupRegularUser();

    // Everyone signed in is a student as far as applying goes (issue #107); only that section,
    // and with no other section to tell it from, no Student heading either (issue #118).
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-greeting")).hasCount(0);
    assertThat(page.locator("h1")).hasCount(0);
    assertThat(page.getByTestId("HomePageLoggedIn-dashboard-none-open"))
        .containsText("Applications are not currently being accepted.");
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_admin_sees_the_admin_section_and_the_student_one() throws Exception {
    setupAdminUser();

    assertThat(page.getByTestId("HomePageLoggedIn-admin")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).containsText("Admin");
    // The recruitments table, empty here: just its headings.
    assertThat(page.getByTestId("HomePageLoggedIn-admin-recruitments")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-student").locator("h2")).hasText("Student");
    assertThat(page.getByTestId("HomePageLoggedIn-instructor")).not().isVisible();
  }

  @Test
  public void logged_in_instructor_sees_the_instructor_section_and_the_student_one()
      throws Exception {
    setupInstructorUser();

    // No catalog name yet, so nothing to list (issue #127).
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none"))
        .containsText("No recruitment includes a course you are listed as teaching.");
    assertThat(page.getByTestId("HomePageLoggedIn-student")).isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-admin")).not().isVisible();
  }

  /** Issue #127: once an admin has assigned the catalog name, the instructor's courses show. */
  @Test
  public void an_instructor_with_a_catalog_name_sees_a_card_per_recruitment_with_their_courses()
      throws Exception {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.OPEN)
                .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
                .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
                .actualOpeningDate(LocalDate.of(2026, 1, 6))
                .build());
    RecruitmentCourse mine =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .enrollCode("07492")
                .section("0100")
                .title("ADV APP PROGRAM")
                .instructor("CONRAD P")
                .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId("CMPSC   130A")
            .enrollCode("07600")
            .section("0100")
            .title("DATA STRUCT")
            .instructor("SOMEONE ELSE")
            .build());
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());

    setupInstructorUser();
    // setupInstructorUser inserts the instructor row without a catalog name; assign one now.
    instructors.save(
        Instructor.builder().email("instructor@ucsb.edu").catalogName("CONRAD P").build());
    page.reload();

    String card = "HomePageLoggedIn-instructor-recruitments-card-" + recruitment.getId();
    assertThat(page.getByTestId(card + "-quarter")).containsText("W26");
    assertThat(page.getByTestId(card + "-applicationStatus")).containsText("OPEN");
    String header = card + "-course-" + mine.getId() + "-header";
    assertThat(page.getByTestId(header)).containsText("CMPSC   156");
    assertThat(page.getByTestId(header)).containsText("(0100) ADV APP PROGRAM");
    // Only the instructor's own course, not the colleague's.
    assertThat(page.getByTestId(card + "-courses")).not().containsText("130A");

    // The accordion opens to the placeholder.
    page.getByTestId(header).getByRole(com.microsoft.playwright.options.AriaRole.BUTTON).click();
    assertThat(page.getByTestId(card + "-course-" + mine.getId() + "-body"))
        .containsText("(Coming soon: options to review and rank applicants)");
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none")).not().isVisible();
  }
}
