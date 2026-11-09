package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
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

/** Issue #427: the admin's Instructor Feedback page, from the quarter card on the home page. */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class InstructorFeedbackWebIT extends WebTestCase {

  @Autowired BudgetRepository budgetRepository;
  @Autowired InstructorFeedbackRepository instructorFeedbackRepository;
  @Autowired InstructorRepository instructorRepository;
  @Autowired CatalogNameRepository catalogNameRepository;

  private static final String TABLE = "InstructorFeedbackPage-table";

  private Recruitment recruitment(RecruitmentType type) {
    return recruitmentRepository.save(
        Recruitment.builder()
            .quarter("20261")
            .type(type)
            .applicationStatus(ApplicationStatus.CLOSED)
            .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
            .build());
  }

  private RecruitmentCourse course(
      Recruitment recruitment, String courseId, String enrollCode, int allocation) {
    return recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(recruitment.getId())
            .courseId(courseId)
            .enrollCode(enrollCode)
            .section("0100")
            .title("A COURSE")
            .instructor("CONRAD P")
            .allocation(allocation)
            .build());
  }

  @Test
  public void an_admin_reads_the_feedback_with_the_allocations_hides_a_column_and_sorts()
      throws Exception {
    Recruitment ta = recruitment(RecruitmentType.TA);
    Recruitment ula = recruitment(RecruitmentType.ULA);
    // CMPSC 156 is in both recruitments; CMPSC 8 in the TA one alone.
    RecruitmentCourse cs156 = course(ta, "CMPSC   156", "07492", 3);
    course(ula, "CMPSC   156", "07492", 4);
    RecruitmentCourse cs8 = course(ta, "CMPSC     8", "07500", 2);
    budgetRepository.save(Budget.builder().quarter("20261").build());
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());
    instructorRepository.save(
        Instructor.builder().email("pconrad@ucsb.edu").catalogName("CONRAD P").build());
    instructorFeedbackRepository.save(
        InstructorFeedback.builder()
            .quarter("20261")
            .email("pconrad@ucsb.edu")
            .recruitmentCourseId(cs156.getId())
            .differentTACount(true)
            .numTAsPreferred(5)
            // Unchecked, so its stored count is not shown.
            .numULAsPreferred(9)
            .comments("One more TA would let us open a fourth lab.")
            .lastUpdated(LocalDateTime.of(2026, 1, 12, 14, 5, 30))
            .build());
    instructorFeedbackRepository.save(
        InstructorFeedback.builder()
            .quarter("20261")
            .email("other@ucsb.edu")
            .recruitmentCourseId(cs8.getId())
            .allocReasonable(true)
            .lastUpdated(LocalDateTime.of(2026, 1, 10, 9, 0))
            .build());

    setupAdminUser();
    openPage(page, "/");
    page.locator("[data-testid$='-quarter-W26-instructorFeedback']").click();
    assertThat(
            page.getByRole(
                AriaRole.HEADING,
                new Page.GetByRoleOptions().setName("Instructor Feedback for W26")))
        .isVisible();

    // One row per record; each found by its course name.
    Locator rows = page.locator("[data-testid^='" + TABLE + "-row-']");
    assertThat(rows).hasCount(2);
    Locator row156 = rows.filter(new Locator.FilterOptions().setHasText("CMPSC 156 (0100)"));
    assertThat(row156.locator("[data-testid$='-col-instructor']"))
        .hasText("CONRAD Ppconrad@ucsb.edu");
    assertThat(row156.locator("[data-testid$='-col-differentTACount']")).hasText("Yes");
    assertThat(row156.locator("[data-testid$='-col-taAllocation']")).hasText("3");
    assertThat(row156.locator("[data-testid$='-col-numTAsPreferred']")).hasText("5");
    assertThat(row156.locator("[data-testid$='-col-differentULACount']")).hasText("No");
    assertThat(row156.locator("[data-testid$='-col-ulaAllocation']")).hasText("4");
    assertThat(row156.locator("[data-testid$='-col-numULAsPreferred']")).hasText("");
    assertThat(row156.locator("[data-testid$='-col-comments']"))
        .hasText("One more TA would let us open a fourth lab.");
    Locator row8 = rows.filter(new Locator.FilterOptions().setHasText("CMPSC   8 (0100)"));
    assertThat(row8.locator("[data-testid$='-col-allocReasonable']")).hasText("Yes");
    assertThat(row8.locator("[data-testid$='-col-taAllocation']")).hasText("2");
    assertThat(row8.locator("[data-testid$='-col-ulaAllocation']")).hasText("N/A");
    assertThat(row8.locator("[data-testid$='-col-instructor']")).hasText("other@ucsb.edu");

    // Hide Comments by its link; it stays hidden after a reload.
    page.getByTestId(TABLE + "-header-comments-hide").click();
    assertThat(page.getByTestId(TABLE + "-header-comments")).hasCount(0);
    reloadPage(page);
    assertThat(page.getByTestId(TABLE + "-row-0")).isVisible();
    assertThat(page.getByTestId(TABLE + "-header-comments")).hasCount(0);

    // Sort by TA Allocation: largest first, then smallest first.
    page.getByTestId(TABLE + "-header-taAllocation-sort-header").click();
    assertThat(page.locator("tbody tr").first().locator("[data-testid$='-col-taAllocation']"))
        .hasText("3");
    page.getByTestId(TABLE + "-header-taAllocation-sort-header").click();
    assertThat(page.locator("tbody tr").first().locator("[data-testid$='-col-taAllocation']"))
        .hasText("2");
  }
}
