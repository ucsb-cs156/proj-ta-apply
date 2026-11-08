package edu.ucsb.cs.taapply.web;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Locator;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
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
 * Issue #250: an admin action on the home page's admin section must refresh the instructor and
 * student sections of the same page, without a reload. The user here is an admin and an instructor
 * at once, so all three sections are on one page.
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
public class HomePageRefreshWebIT extends WebTestCase {

  private static final String ADMIN_EMAIL = "admin@ucsb.edu";

  @Autowired CatalogNameRepository catalogNameRepository;
  @Autowired InstructorRepository instructors;

  /** CMPSC 156, taught by CONRAD P, who is the admin below. */
  private void stubOffering() {
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
                             "instructors":[{"instructor":"CONRAD P"}]}
                          ]}
                        ]}
                        """)));
  }

  /**
   * The recruitments job fills the courses in the background, so reload until the locator shows.
   */
  private void waitFor(Locator locator) {
    for (int i = 0; i < 20 && !locator.isVisible(); i++) {
      page.waitForTimeout(500);
      reloadPage(page);
    }
  }

  @Test
  public void
      deleting_a_recruitment_removes_its_course_from_the_instructor_section_without_a_reload()
          throws Exception {
    courseRepository.save(
        Course.builder().courseId("CMPSC   156").title("ADV APP PROGRAM").needsTa(true).build());
    catalogNameRepository.save(CatalogName.builder().name("CONRAD P").build());
    stubOffering();

    setupAdminUser();
    // The admin also teaches: give the same email an instructor row with the catalog name.
    instructors.save(Instructor.builder().email(ADMIN_EMAIL).catalogName("CONRAD P").build());
    reloadPage(page);

    // Nothing to list yet in the instructor section.
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none"))
        .containsText("No recruitment includes a course you are listed as teaching.");

    // The admin creates a TA recruitment; the job fills in the courses CONRAD P teaches.
    page.getByTestId("HomePageLoggedIn-admin-create-button").click();
    page.getByTestId("RecruitmentForm-tentativeOpeningDate").fill("2026-01-05");
    page.getByTestId("RecruitmentForm-primaryConsiderationDate").fill("2026-01-20");
    page.getByTestId("RecruitmentForm-submit").click();
    waitFor(page.getByTestId("HomePageLoggedIn-admin-card-0-type"));

    // Issue #364: the instructor section's card is the quarter's, not the recruitment's.
    String quarter = recruitmentRepository.findAll().iterator().next().getQuarter();
    String instructorCard = "HomePageLoggedIn-instructor-recruitments-quarter-" + quarter;
    waitFor(page.getByTestId(instructorCard + "-courses"));

    // The course shows in the instructor section.
    assertThat(page.getByTestId(instructorCard + "-courses")).containsText("CMPSC   156");
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none")).not().isVisible();

    // From here on the page must not be reloaded; this marker would not survive a reload.
    page.evaluate("window.__noReload = true");

    // Delete the recruitment from the admin section.
    page.getByTestId("HomePageLoggedIn-admin-card-0-delete-button").click();
    page.getByTestId("RecruitmentDeleteModal-confirm").click();

    // The admin card goes, and so does the course in the instructor section.
    assertThat(page.getByTestId("HomePageLoggedIn-admin-card-0-type")).not().isVisible();
    assertThat(page.getByTestId(instructorCard + "-courses")).not().isVisible();
    assertThat(page.getByTestId("HomePageLoggedIn-instructor-none"))
        .containsText("No recruitment includes a course you are listed as teaching.");
    assertEquals(true, page.evaluate("window.__noReload === true"));
  }
}
