package edu.ucsb.cs.taapply.web;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Download;
import edu.ucsb.cs.taapply.WebTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.FundingSource;
import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.HiringRecordRepository;
import edu.ucsb.cs.taapply.testconfig.IntegrationConfig;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
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
 * Issue #509 and part 2 of issue #512: the staff's hiring-tracking fields on the Soft Offer Results
 * page (stamped checkboxes, the New Hire form dropdown, Staff Comments and Funding), which admins
 * and hiring staff edit in place, and which the CSV carries; and the refusal to delete a funding
 * source a hiring record still carries.
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
@ResourceLock("port-8080")
@Import(IntegrationConfig.class)
public class SoftOfferHiringWebIT extends WebTestCase {

  @Autowired ApplicationRepository applicationRepository;
  @Autowired HiringRecordRepository hiringRecordRepository;

  private static final String T = "SoftOfferResultsPage-table";
  private static final String FUNDING_TABLE = "FundingSourcesIndexPage";
  private static final String HIRING_URL = "/api/admin/softOffers/hiring";

  /** The two lines under a stamped control: mm/dd/yy and h:mm AM/PM. */
  private static final Pattern SHORT_DATE = Pattern.compile("\\d\\d/\\d\\d/\\d\\d");

  private static final Pattern SHORT_TIME = Pattern.compile("\\d{1,2}:\\d\\d [AP]M");

  /** The one assigned applicant's application, from {@link #seedReleasedUla()}. */
  private Long applicationId;

  /**
   * A released F26 ULA recruitment with hiring decisions published, one lecture, and one applicant
   * assigned to it, so the Soft Offer Results have one row.
   */
  private Recruitment seedReleasedUla() {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20264")
                .type(RecruitmentType.ULA)
                .applicationStatus(ApplicationStatus.CLOSED)
                .reviewStatus("Closed")
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.of(2026, 9, 20))
                .assignmentsPublished(true)
                .assignmentsPublishedAt(LocalDateTime.of(2026, 10, 1, 9, 0))
                .softOffersReleasedAt(LocalDateTime.of(2026, 10, 20, 9, 30))
                .softOfferDeadline(LocalDateTime.of(2999, 12, 1, 17, 0))
                .build());
    RecruitmentCourse lecture =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitment.getId())
                .courseId("CMPSC   156")
                .section("0100")
                .enrollCode("07492")
                .title("ADV APP PROGRAM")
                .instructor("CONRAD P")
                .removed(false)
                .build());
    applicationId =
        applicationRepository
            .save(
                Application.builder()
                    .recruitmentId(recruitment.getId())
                    .email("cgaucho@ucsb.edu")
                    .status(ApplicationReviewStatus.PENDING)
                    .firstName("Chris")
                    .lastName("Gaucho")
                    .tentativeAssignmentId(lecture.getId())
                    .build())
            .getId();
    return recruitment;
  }

  private void seedSub0() {
    fundingSourceRepository.save(
        FundingSource.builder().abbreviation("sub0").explanation("Temporary Sub Zero").build());
  }

  private HiringRecord storedRecord() {
    return hiringRecordRepository.findByApplicationId(applicationId).orElseThrow();
  }

  /** Does the action and waits for the save it causes to be answered. */
  private void saving(Runnable action) {
    page.waitForResponse(
        response ->
            response.url().contains(HIRING_URL) && "PUT".equals(response.request().method()),
        action);
  }

  /** A line of the CSV as its cells: every cell is quoted, and no value here holds a quote. */
  private static List<String> csvCells(String line) {
    return Arrays.asList(line.substring(1, line.length() - 1).split("\",\""));
  }

  @Test
  public void hiring_staff_tick_choose_and_comment_the_values_persist_and_reach_the_csv()
      throws Exception {
    Recruitment recruitment = seedReleasedUla();
    seedSub0();
    setupHiringStaffUser();
    openPage(page, "/admin/recruitments/" + recruitment.getId() + "/softOffers");

    assertThat(page.getByTestId("SoftOfferResultsPage-title"))
        .hasText("Soft Offer Results: F26 ULA");
    assertThat(page.getByTestId(T + "-cell-row-0-col-firstName")).hasText("Chris");
    // The nine columns are shown by default: Funding after Course assignment, the staff columns
    // after Comments, each with its hide link.
    assertThat(page.getByTestId(T + "-header-funding-sort-header")).hasText("Funding");
    assertThat(page.getByTestId(T + "-header-staffComments-sort-header")).hasText("Staff Comments");
    assertThat(page.getByTestId(T + "-header-newHireForm-sort-header"))
        .hasText("New Hire form done (or not needed)");
    assertThat(page.getByTestId(T + "-header-funding-hide")).isVisible();
    assertThat(page.getByTestId("SoftOfferResultsPage-columns-toggle"))
        .hasText("Columns (5 hidden)");

    // Formal Offer Sent: ticking stamps it with the server's time, in the two short lines. The box
    // is clicked, not checked: it shows the stored stamp, so it only flips once the save answers,
    // which Playwright's check() would take for a click that did nothing.
    String sent = T + "-hiring-row-0-formalOfferSent";
    assertThat(page.getByTestId(sent + "-checkbox")).not().isChecked();
    assertThat(page.getByTestId(sent + "-stamp")).hasCount(0);
    saving(() -> page.getByTestId(sent + "-checkbox").click());
    assertThat(page.getByTestId(sent + "-checkbox")).isChecked();
    assertThat(page.getByTestId(sent + "-stamp-date")).hasText(SHORT_DATE);
    assertThat(page.getByTestId(sent + "-stamp-time")).hasText(SHORT_TIME);
    HiringRecord stored = storedRecord();
    assertNotNull(stored.getFormalOfferSentAt());
    assertEquals("hiringstaff@ucsb.edu", stored.getUpdatedByEmail());
    assertNull(stored.getFormalOfferAcceptedAt());

    // Still there after a reload; unticking clears it; ticking again stamps it anew.
    reloadPage(page);
    assertThat(page.getByTestId(sent + "-checkbox")).isChecked();
    assertThat(page.getByTestId(sent + "-stamp-date")).hasText(SHORT_DATE);
    saving(() -> page.getByTestId(sent + "-checkbox").click());
    assertThat(page.getByTestId(sent + "-checkbox")).not().isChecked();
    assertThat(page.getByTestId(sent + "-stamp")).hasCount(0);
    assertNull(storedRecord().getFormalOfferSentAt());
    saving(() -> page.getByTestId(sent + "-checkbox").click());
    assertThat(page.getByTestId(sent + "-stamp-date")).hasText(SHORT_DATE);

    // New Hire form: Done, with a stamp under it.
    String form = T + "-hiring-row-0-newHireForm";
    assertThat(page.getByTestId(form + "-stamp")).hasCount(0);
    saving(() -> page.getByTestId(form + "-select").selectOption("DONE"));
    assertThat(page.getByTestId(form + "-select")).hasValue("DONE");
    assertThat(page.getByTestId(form + "-stamp-date")).hasText(SHORT_DATE);
    assertEquals(NewHireForm.DONE, storedRecord().getNewHireForm());

    // Staff Comments save when the box loses focus.
    String comments = T + "-hiring-row-0-staffComments";
    page.getByTestId(comments).fill("Needs an I-9 appointment.");
    saving(() -> page.getByTestId(comments).blur());
    assertEquals("Needs an I-9 appointment.", storedRecord().getStaffComments());

    // Funding: the source the admin created, labelled by abbreviation.
    String funding = T + "-hiring-row-0-funding";
    assertThat(page.getByTestId(funding).locator("option")).hasText(new String[] {"", "sub0"});
    saving(() -> page.getByTestId(funding).selectOption("sub0"));
    assertThat(page.getByTestId(funding)).hasValue("sub0");
    assertEquals("sub0", storedRecord().getFundingSource());

    // Everything is still there after a reload.
    reloadPage(page);
    assertThat(page.getByTestId(sent + "-checkbox")).isChecked();
    assertThat(page.getByTestId(form + "-select")).hasValue("DONE");
    assertThat(page.getByTestId(form + "-stamp-time")).hasText(SHORT_TIME);
    assertThat(page.getByTestId(comments)).hasValue("Needs an I-9 appointment.");
    assertThat(page.getByTestId(funding)).hasValue("sub0");
    assertThat(page.getByTestId(T + "-hiring-row-0-inUcpath-checkbox")).not().isChecked();

    // The CSV carries the values: Yes and the stamp, Done and its stamp, the comment, and the
    // abbreviation in the Funding column after Course assignment. (ApplicationsSubmittedWebIT
    // asserts the header row in full.)
    HiringRecord record = storedRecord();
    Download download =
        page.waitForDownload(() -> page.getByTestId("SoftOfferResultsPage-csv").click());
    List<String> lines = Files.readAllLines(download.path());
    assertEquals(2, lines.size());
    List<String> header = csvCells(lines.get(0));
    List<String> row = csvCells(lines.get(1));
    assertEquals(header.size(), row.size());
    assertEquals("Chris", row.get(header.indexOf("First name")));
    assertEquals("CMPSC 156", row.get(header.indexOf("Course assignment")));
    assertEquals("sub0", row.get(header.indexOf("Funding")));
    assertEquals(header.indexOf("Course assignment") + 1, header.indexOf("Funding"));
    assertEquals("Yes", row.get(header.indexOf("Formal Offer Sent")));
    assertEquals(
        String.valueOf(record.getFormalOfferSentAt()),
        row.get(header.indexOf("Formal Offer Sent Date/Time")));
    assertEquals("", row.get(header.indexOf("Formal Offer Accepted")));
    assertEquals("", row.get(header.indexOf("Formal Offer Accepted Date/Time")));
    assertEquals("Done", row.get(header.indexOf("New Hire form done (or not needed)")));
    assertEquals(
        String.valueOf(record.getNewHireFormAt()),
        row.get(header.indexOf("New Hire form Date/Time")));
    assertEquals("", row.get(header.indexOf("In UCPath")));
    assertEquals("", row.get(header.indexOf("I-9 Complete")));
    assertEquals("Needs an I-9 appointment.", row.get(header.indexOf("Staff Comments")));
  }

  /**
   * Issue #512, part 2: a funding source a hiring record carries cannot be deleted; an admin, who
   * edits the hiring fields too, clears the row's Funding and then can.
   */
  @Test
  public void an_admin_cannot_delete_a_funding_source_in_use_until_the_rows_are_cleared()
      throws Exception {
    Recruitment recruitment = seedReleasedUla();
    seedSub0();
    hiringRecordRepository.save(
        HiringRecord.builder()
            .applicationId(applicationId)
            .fundingSource("sub0")
            .updatedAt(LocalDateTime.of(2026, 10, 21, 8, 0))
            .updatedByEmail("admin@ucsb.edu")
            .build());
    setupAdminUser();
    openPage(page, "/admin/fundingSources");

    assertThat(page.getByTestId(FUNDING_TABLE + "-cell-row-0-col-abbreviation")).hasText("sub0");
    page.getByTestId(FUNDING_TABLE + "-cell-row-0-col-delete-button").click();
    assertThat(
            page.getByText(
                "Funding source sub0 is used by 1 hiring record(s) and cannot be deleted."))
        .isVisible();
    assertThat(page.getByTestId(FUNDING_TABLE + "-cell-row-0-col-abbreviation")).hasText("sub0");
    assertTrue(fundingSourceRepository.existsById("sub0"));

    // The admin clears the row's Funding on the results page.
    openPage(page, "/admin/recruitments/" + recruitment.getId() + "/softOffers");
    String funding = T + "-hiring-row-0-funding";
    assertThat(page.getByTestId(funding)).hasValue("sub0");
    saving(() -> page.getByTestId(funding).selectOption(""));
    assertThat(page.getByTestId(funding)).hasValue("");
    assertNull(storedRecord().getFundingSource());
    assertEquals("admin@ucsb.edu", storedRecord().getUpdatedByEmail());

    // Now the source can go.
    openPage(page, "/admin/fundingSources");
    page.getByTestId(FUNDING_TABLE + "-cell-row-0-col-delete-button").click();
    assertThat(page.getByText("FundingSource with id sub0 deleted")).isVisible();
    assertThat(page.getByTestId(FUNDING_TABLE + "-cell-row-0-col-abbreviation")).hasCount(0);
    assertFalse(fundingSourceRepository.existsById("sub0"));
  }
}
