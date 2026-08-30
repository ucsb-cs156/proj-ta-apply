package edu.ucsb.cs.taapply.web;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

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
 * End-to-end coverage of the admin Courses page, including the populate job. The UCSB curriculum
 * API is stubbed on the same WireMock server that mocks OAuth (see
 * application-integration.properties), so nothing here calls api.ucsb.edu or needs an API key.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class CoursesWebIT extends WebTestCase {

  private void goToCoursesPage() {
    page.navigate(page.url().replaceAll("(http://localhost:\\d+).*", "$1/admin/courses"));
  }

  /** Stubs the curriculum search so every quarter returns the same two courses. */
  private void stubCurriculumApi() {
    wireMockServer.stubFor(
        get(urlPathEqualTo("/academics/curriculums/v1/classes/search"))
            .willReturn(
                aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                        {"classes":[
                          {"courseId":"CMPSC   156","title":"ADV APP PROGRAM"},
                          {"courseId":"CMPSC   130A","title":"DATA STRUCT ALGOR I"}
                        ]}
                        """)));
  }

  @Test
  public void admin_sees_existing_courses_in_the_table() throws Exception {
    courseRepository.save(
        Course.builder()
            .courseId("CMPSC 156")
            .title("ADV APP PROGRAM")
            .needsTa(true)
            .needsUla(false)
            .build());

    setupAdminUser();
    goToCoursesPage();

    assertThat(page.getByTestId("CoursesIndexPage-cell-row-0-col-courseId"))
        .containsText("CMPSC 156");
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-0-col-needsTa-checkbox")).isChecked();
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-0-col-needsUla-checkbox"))
        .not()
        .isChecked();
  }

  @Test
  public void ticking_the_ula_box_persists_across_a_reload() throws Exception {
    courseRepository.save(Course.builder().courseId("CMPSC 156").title("ADV APP PROGRAM").build());

    setupAdminUser();
    goToCoursesPage();

    Locator ulaBox = page.getByTestId("CoursesIndexPage-cell-row-0-col-needsUla-checkbox");
    assertThat(ulaBox).not().isChecked();
    ulaBox.click();
    assertThat(ulaBox).isChecked();

    page.reload();

    assertThat(page.getByTestId("CoursesIndexPage-cell-row-0-col-needsUla-checkbox")).isChecked();
  }

  @Test
  public void populate_adds_courses_from_the_api() throws Exception {
    stubCurriculumApi();
    setupAdminUser();
    goToCoursesPage();

    page.getByTestId("CoursesIndexPage-populate").click();

    // The job runs asynchronously; poll the page until its rows appear.
    Locator firstRow = page.getByTestId("CoursesIndexPage-cell-row-0-col-courseId");
    for (int i = 0; i < 20 && !firstRow.isVisible(); i++) {
      page.waitForTimeout(500);
      page.reload();
    }

    // Course ids are normalized from the API's space-padded form, and sorted.
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-0-col-courseId"))
        .containsText("CMPSC 130A");
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-1-col-courseId"))
        .containsText("CMPSC 156");
  }

  @Test
  public void populate_leaves_existing_flags_alone() throws Exception {
    courseRepository.save(
        Course.builder()
            .courseId("CMPSC 156")
            .title("Stale Title")
            .needsTa(true)
            .needsUla(true)
            .build());

    stubCurriculumApi();
    setupAdminUser();
    goToCoursesPage();

    page.getByTestId("CoursesIndexPage-populate").click();

    Locator secondRow = page.getByTestId("CoursesIndexPage-cell-row-1-col-courseId");
    for (int i = 0; i < 20 && !secondRow.isVisible(); i++) {
      page.waitForTimeout(500);
      page.reload();
    }

    // CMPSC 156 sorts second; its title is refreshed but both flags survive.
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-1-col-title"))
        .containsText("ADV APP PROGRAM");
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-1-col-needsTa-checkbox")).isChecked();
    assertThat(page.getByTestId("CoursesIndexPage-cell-row-1-col-needsUla-checkbox")).isChecked();
  }

  @Test
  public void non_admin_is_denied_access_to_the_courses_page() throws Exception {
    setupRegularUser();
    goToCoursesPage();

    assertThat(page.getByText("You do not have access to this page.")).isVisible();
  }
}
