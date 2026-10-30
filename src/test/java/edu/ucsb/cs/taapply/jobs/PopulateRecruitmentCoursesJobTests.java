package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(classes = PopulateRecruitmentCoursesJobTests.class)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class PopulateRecruitmentCoursesJobTests {

  @Mock private UCSBCurriculumService ucsbCurriculumService;
  @Mock private CourseRepository courseRepository;
  @Mock private RecruitmentCourseRepository recruitmentCourseRepository;
  @Mock private JobRateLimit jobRateLimit;

  private JobContext ctx;
  private Job jobStarted;

  @BeforeEach
  void setup() {
    jobStarted = Job.builder().build();
    ctx = new JobContext(null, jobStarted);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(any(), any()))
        .thenReturn(Optional.empty());
  }

  private PopulateRecruitmentCoursesJob job(RecruitmentType type) {
    return PopulateRecruitmentCoursesJob.builder()
        .recruitment(Recruitment.builder().id(7L).quarter("20261").type(type).build())
        .subjectArea("CMPSC")
        .ucsbCurriculumService(ucsbCurriculumService)
        .courseRepository(courseRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .jobRateLimit(jobRateLimit)
        .build();
  }

  private static Course course(String id, boolean needsTa, boolean needsUla) {
    return Course.builder().courseId(id).needsTa(needsTa).needsUla(needsUla).build();
  }

  private static UcsbSection section(String enrollCode, String sectionNumber, String instructor) {
    return UcsbSection.builder()
        .enrollCode(enrollCode)
        .section(sectionNumber)
        .enrolledTotal(100)
        .maxEnroll(120)
        .instructors(
            instructor == null
                ? List.of()
                : List.of(UcsbInstructor.builder().instructor(instructor).build()))
        .timeLocations(
            List.of(
                UcsbTimeLocation.builder()
                    .days("T R")
                    .beginTime("14:00")
                    .endTime("15:15")
                    .building("PHELP")
                    .room("3526")
                    .build()))
        .build();
  }

  private static UcsbCourseOffering offering(String courseId, UcsbSection... sections) {
    return UcsbCourseOffering.builder()
        .courseId(courseId)
        .title("A Title")
        .classSections(List.of(sections))
        .build();
  }

  // ---- which courses are eligible ----

  /** A TA recruitment reads needsTa; a course wanting only a ULA is not in it. */
  @Test
  public void a_ta_recruitment_takes_only_courses_flagged_for_tas() throws Exception {
    when(courseRepository.findAll())
        .thenReturn(
            List.of(course("CMPSC   156", true, false), course("CMPSC   130A", false, true)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC   130A ", section("07600", "0100", "SOMEONE"))));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals("CMPSC   156", captor.getValue().getCourseId());
  }

  @Test
  public void a_ula_recruitment_takes_only_courses_flagged_for_ulas() throws Exception {
    when(courseRepository.findAll())
        .thenReturn(
            List.of(course("CMPSC   156", true, false), course("CMPSC   130A", false, true)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC   130A ", section("07600", "0100", "SOMEONE"))));

    job(RecruitmentType.ULA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals("CMPSC   130A", captor.getValue().getCourseId());
  }

  @Test
  public void a_course_not_offered_that_quarter_is_skipped() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261")).thenReturn(List.of());

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(any());
  }

  @Test
  public void nothing_happens_and_no_api_call_is_made_when_no_course_is_flagged() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", false, false)));

    job(RecruitmentType.TA).accept(ctx);

    verify(ucsbCurriculumService, never()).getOfferings(any(), any());
    verify(recruitmentCourseRepository, never()).save(any());
    assertTrue(jobStarted.getLog().contains("No courses are flagged"));
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 0 added, 0 updated, 0 left removed, 0 marked stale, 0 un-staled"),
        jobStarted.getLog());
  }

  /** Issue #122: with nothing flagged, every row on file is of an unflagged course, so stale. */
  @Test
  public void with_no_course_flagged_the_rows_on_file_are_marked_stale_without_an_api_call()
      throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", false, false)));
    RecruitmentCourse row = existingRow(1L, "CMPSC   156", "07492", false, false);
    RecruitmentCourse removed = existingRow(2L, "CMPSC   156", "07500", true, false);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(row, removed));

    job(RecruitmentType.TA).accept(ctx);

    verify(ucsbCurriculumService, never()).getOfferings(any(), any());
    assertTrue(row.isStale());
    assertFalse(removed.isStale(), "a removed row is the admin's business and is left alone");
    verify(recruitmentCourseRepository, times(1)).save(row);
    verify(recruitmentCourseRepository, never()).save(removed);
    assertTrue(jobStarted.getLog().contains("1 marked stale, 0 un-staled"), jobStarted.getLog());
  }

  // ---- reconciliation (issue #122) ----

  private static RecruitmentCourse existingRow(
      long id, String courseId, String enrollCode, boolean removed, boolean stale) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(courseId)
        .enrollCode(enrollCode)
        .section("0100")
        .removed(removed)
        .stale(stale)
        .build();
  }

  /** A lecture that vanished from the API is marked stale; one that is still there is not. */
  @Test
  public void a_row_whose_section_is_no_longer_in_the_api_is_marked_stale() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse kept = existingRow(1L, "CMPSC   156", "07492", false, false);
    RecruitmentCourse gone = existingRow(2L, "CMPSC   156", "07500", false, false);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(kept));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(kept, gone));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(kept.isStale());
    assertTrue(gone.isStale());
    verify(recruitmentCourseRepository, times(1)).save(gone);
    assertTrue(
        jobStarted.getLog().contains("CMPSC   156 section 0100 is no longer offered or flagged"),
        jobStarted.getLog());
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 0 added, 1 updated, 0 left removed, 1 marked stale, 0 un-staled"),
        jobStarted.getLog());
  }

  /** A section that comes back is restored without anyone touching it. */
  @Test
  public void a_stale_row_found_again_is_un_staled() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse back = existingRow(1L, "CMPSC   156", "07492", false, true);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(back));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(back));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(back.isStale());
    // Saved once by the upsert, which clears the flag and counts it; the reconciliation leaves it.
    verify(recruitmentCourseRepository, times(1)).save(back);
    assertTrue(jobStarted.getLog().contains("0 marked stale, 1 un-staled"), jobStarted.getLog());
  }

  /**
   * Un-staling counts when the reconciliation itself clears a flag: a seen but removed row stays.
   */
  @Test
  public void a_stale_row_whose_course_is_flagged_again_but_which_the_upsert_skipped_is_counted()
      throws Exception {
    // The row is removed, so the upsert skips it, and the reconciliation leaves it alone too.
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse removedStale = existingRow(1L, "CMPSC   156", "07492", true, true);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(removedStale));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(removedStale));

    job(RecruitmentType.TA).accept(ctx);

    assertTrue(removedStale.isStale());
    verify(recruitmentCourseRepository, never()).save(any());
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 0 added, 0 updated, 1 left removed, 0 marked stale, 0 un-staled"),
        jobStarted.getLog());
  }

  /** Unflagging a course makes its rows stale on the next run, while a flagged one's stay. */
  @Test
  public void rows_of_a_course_no_longer_flagged_are_marked_stale() throws Exception {
    when(courseRepository.findAll())
        .thenReturn(
            List.of(course("CMPSC   156", true, false), course("CMPSC     8", false, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC     8  ", section("07100", "0100", "GAUCHO C"))));
    RecruitmentCourse stillWanted = existingRow(1L, "CMPSC   156", "07492", false, false);
    RecruitmentCourse unflagged = existingRow(2L, "CMPSC     8", "07100", false, false);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(stillWanted));
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(stillWanted, unflagged));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(stillWanted.isStale());
    assertTrue(unflagged.isStale());
    assertTrue(jobStarted.getLog().contains("1 marked stale, 0 un-staled"), jobStarted.getLog());
  }

  /** A row already stale and still missing is left as it is, not saved again. */
  @Test
  public void a_row_already_stale_and_still_missing_is_not_saved_again() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse kept = existingRow(1L, "CMPSC   156", "07492", false, false);
    RecruitmentCourse stillGone = existingRow(2L, "CMPSC   156", "07500", false, true);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(kept));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(kept, stillGone));

    job(RecruitmentType.TA).accept(ctx);

    assertTrue(stillGone.isStale());
    verify(recruitmentCourseRepository, never()).save(stillGone);
    assertTrue(jobStarted.getLog().contains("0 marked stale, 0 un-staled"), jobStarted.getLog());
  }

  /** The guard: an empty answer from the API must not mark everything stale. */
  @Test
  public void an_empty_offerings_response_changes_no_stale_flags() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261")).thenReturn(List.of());
    RecruitmentCourse fresh = existingRow(1L, "CMPSC   156", "07492", false, false);
    RecruitmentCourse stale = existingRow(2L, "CMPSC   156", "07500", false, true);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(fresh, stale));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(fresh.isStale());
    assertTrue(stale.isStale());
    verify(recruitmentCourseRepository, never()).save(any());
    assertTrue(jobStarted.getLog().contains("No offerings returned"), jobStarted.getLog());
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 0 added, 0 updated, 0 left removed, 0 marked stale, 0 un-staled"),
        jobStarted.getLog());
  }

  /** A failing fetch throws before any reconciliation, so no flag changes either. */
  @Test
  public void a_failing_fetch_changes_no_stale_flags() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenThrow(new RuntimeException("API down"));
    RecruitmentCourse fresh = existingRow(1L, "CMPSC   156", "07492", false, false);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(fresh));

    assertThrows(RuntimeException.class, () -> job(RecruitmentType.TA).accept(ctx));

    assertFalse(fresh.isStale());
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @Test
  public void isOnOffer_means_neither_removed_nor_stale_nor_cancelled() {
    assertTrue(existingRow(1L, "CMPSC   156", "07492", false, false).isOnOffer());
    assertFalse(existingRow(1L, "CMPSC   156", "07492", true, false).isOnOffer());
    assertFalse(existingRow(1L, "CMPSC   156", "07492", false, true).isOnOffer());
    assertFalse(existingRow(1L, "CMPSC   156", "07492", true, true).isOnOffer());
    // Issue #123: a cancelled lecture is not on offer; closed (full) and open ones are.
    for (String status : new String[] {"open", "closed", null}) {
      RecruitmentCourse row = existingRow(1L, "CMPSC   156", "07492", false, false);
      row.setStatus(status);
      assertTrue(row.isOnOffer(), String.valueOf(status));
    }
    RecruitmentCourse cancelled = existingRow(1L, "CMPSC   156", "07492", false, false);
    cancelled.setStatus(RecruitmentCourse.CANCELLED);
    assertFalse(cancelled.isOnOffer());
    assertEquals("cancelled", RecruitmentCourse.CANCELLED);
  }

  // ---- rows added by hand (issue #125) ----

  private static RecruitmentCourse manualRow(long id, String courseId, String enrollCode) {
    RecruitmentCourse row = existingRow(id, courseId, enrollCode, false, false);
    row.setManuallyAdded(true);
    row.setInstructor("OLD NAME");
    return row;
  }

  /** Its course is not flagged, yet the row is refreshed and not stale while the API has it. */
  @Test
  public void a_manually_added_row_of_an_unflagged_course_is_refreshed_not_staled()
      throws Exception {
    when(courseRepository.findAll())
        .thenReturn(
            List.of(course("CMPSC   156", true, false), course("CMPSC     8", false, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC     8  ", section("07100", "0100", "GAUCHO C"))));
    RecruitmentCourse manual = manualRow(2L, "CMPSC     8", "07100");
    manual.setStale(true);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(manual));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(manual.isStale());
    assertEquals("GAUCHO C", manual.getInstructor());
    assertTrue(manual.isManuallyAdded());
    verify(recruitmentCourseRepository, times(1)).save(manual);
    assertTrue(jobStarted.getLog().contains("CMPSC     8 section 0100 (added by hand)"));
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 1 added, 1 updated, 0 left removed, 0 marked stale, 1 un-staled"),
        jobStarted.getLog());
  }

  /** A fresh manual row is simply refreshed: updated, nothing un-staled. */
  @Test
  public void a_fresh_manually_added_row_counts_as_updated_only() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC     8  ", section("07100", "0100", "GAUCHO C"))));
    RecruitmentCourse manual = manualRow(2L, "CMPSC     8", "07100");
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(manual));

    job(RecruitmentType.TA).accept(ctx);

    assertFalse(manual.isStale());
    assertEquals("GAUCHO C", manual.getInstructor());
    assertTrue(
        jobStarted
            .getLog()
            .contains("Finished: 1 added, 1 updated, 0 left removed, 0 marked stale, 0 un-staled"),
        jobStarted.getLog());
  }

  /** Once its section is gone from the API, a manual row goes stale like any other. */
  @Test
  public void a_manually_added_row_whose_section_is_gone_is_marked_stale() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse manual = manualRow(2L, "CMPSC     8", "07100");
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(manual));

    job(RecruitmentType.TA).accept(ctx);

    assertTrue(manual.isStale());
    assertEquals("OLD NAME", manual.getInstructor());
  }

  /** A manual row of a flagged course is handled by the ordinary path, once. */
  @Test
  public void a_manually_added_row_of_a_flagged_course_is_not_refreshed_twice() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    RecruitmentCourse manual = manualRow(2L, "CMPSC   156", "07492");
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(manual));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(manual));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, times(1)).save(manual);
    assertTrue(jobStarted.getLog().contains("Finished: 0 added, 1 updated"), jobStarted.getLog());
  }

  /** A removed manual row is the admin's business: neither refreshed nor marked. */
  @Test
  public void a_removed_manually_added_row_is_left_alone() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC   156  ", section("07492", "0100", "CONRAD P")),
                offering("CMPSC     8  ", section("07100", "0100", "GAUCHO C"))));
    RecruitmentCourse manual = manualRow(2L, "CMPSC     8", "07100");
    manual.setRemoved(true);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(manual));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(manual);
    assertEquals("OLD NAME", manual.getInstructor());
    assertFalse(manual.isStale());
  }

  // ---- primaries ----

  /** The heart of it: two lectures are two rows, each with its own instructor and enrollment. */
  @Test
  public void both_primary_sections_of_a_course_become_rows() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    UcsbSection first = section("07492", "0100", "CONRAD P");
    UcsbSection second = section("07500", "0200", "SOMEONE ELSE");
    second.setEnrolledTotal(60);
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", first, second)));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(2)).save(captor.capture());
    assertEquals(
        List.of("CONRAD P", "SOMEONE ELSE"),
        captor.getAllValues().stream().map(RecruitmentCourse::getInstructor).toList());
    assertEquals(
        List.of(100, 60),
        captor.getAllValues().stream().map(RecruitmentCourse::getEnrollment).toList());
    assertEquals(
        List.of("07492", "07500"),
        captor.getAllValues().stream().map(RecruitmentCourse::getEnrollCode).toList());
  }

  /** Discussions and labs are not recruited for separately. */
  @Test
  public void secondary_sections_are_ignored() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering(
                    "CMPSC   156  ",
                    section("07492", "0100", "CONRAD P"),
                    section("07493", "0101", "A TA"))));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals("0100", captor.getValue().getSection());
  }

  @Test
  public void a_section_without_an_enroll_code_is_skipped() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section(null, "0100", "CONRAD P"))));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(any());
  }

  @Test
  public void an_offering_with_no_sections_is_skipped() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(UcsbCourseOffering.builder().courseId("CMPSC   156  ").build()));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(any());
  }

  // ---- the invariant ----

  /**
   * The one thing a re-run must never do: undo an admin's decision to drop a course. Deleting the
   * row instead of flagging it would make this impossible to honor.
   */
  @Test
  public void a_removed_course_is_not_added_back_by_a_rerun() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(
            Optional.of(
                RecruitmentCourse.builder().id(1L).enrollCode("07492").removed(true).build()));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(any());
    assertTrue(
        jobStarted.getLog().contains("Finished: 0 added, 0 updated, 1 left removed"),
        jobStarted.getLog());
  }

  /** An existing, not-removed row is refreshed rather than duplicated. */
  @Test
  public void an_existing_row_is_updated_in_place() throws Exception {
    RecruitmentCourse existing =
        RecruitmentCourse.builder()
            .id(1L)
            .enrollCode("07492")
            .instructor("STALE NAME")
            .removed(false)
            .build();
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(existing));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals(1L, captor.getValue().getId(), "same row, not a duplicate");
    assertEquals("CONRAD P", captor.getValue().getInstructor());
    assertTrue(
        jobStarted.getLog().contains("Finished: 0 added, 1 updated, 0 left removed"),
        jobStarted.getLog());
  }

  // ---- field mapping ----

  @Test
  public void offering_details_are_mapped_onto_the_row() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    UcsbSection s = section("07492", "0100", "CONRAD P");
    s.setSession("A");
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", s)));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository).save(captor.capture());
    RecruitmentCourse row = captor.getValue();
    assertEquals(7L, row.getRecruitmentId());
    assertEquals("A Title", row.getTitle());
    assertEquals("T R", row.getDays());
    assertEquals("14:00 - 15:15", row.getTime());
    assertEquals("PHELP 3526", row.getRoom());
    assertEquals(120, row.getMaxEnroll());
    assertEquals("open", row.getStatus());
    assertEquals("A", row.getSummerSession());
  }

  @Test
  public void a_section_with_no_meeting_time_or_instructor_maps_to_nulls() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    UcsbSection online =
        UcsbSection.builder()
            .enrollCode("07492")
            .section("0100")
            .timeLocations(List.of())
            .instructors(List.of())
            .build();
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", online)));

    job(RecruitmentType.TA).accept(ctx);

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository).save(captor.capture());
    assertNull(captor.getValue().getInstructor());
    assertNull(captor.getValue().getDays());
    assertNull(captor.getValue().getTime());
    assertNull(captor.getValue().getRoom());
  }

  @Test
  public void null_time_and_instructor_lists_are_tolerated() {
    UcsbSection bare = UcsbSection.builder().enrollCode("1").section("0100").build();
    assertNull(PopulateRecruitmentCoursesJob.firstInstructor(bare));
    assertNull(PopulateRecruitmentCoursesJob.firstDays(bare));
    assertNull(PopulateRecruitmentCoursesJob.firstTime(bare));
    assertNull(PopulateRecruitmentCoursesJob.firstRoom(bare));
  }

  @Test
  public void a_room_without_a_building_falls_back_to_the_room_alone() {
    UcsbSection s =
        UcsbSection.builder()
            .timeLocations(List.of(UcsbTimeLocation.builder().room("1401").build()))
            .build();
    assertEquals("1401", PopulateRecruitmentCoursesJob.firstRoom(s));
  }

  @Test
  public void a_building_without_a_room_does_not_leave_a_trailing_space() {
    UcsbSection s =
        UcsbSection.builder()
            .timeLocations(List.of(UcsbTimeLocation.builder().building("PHELP").build()))
            .build();
    assertEquals("PHELP", PopulateRecruitmentCoursesJob.firstRoom(s));
  }

  /** Cancellation wins over closure: a cancelled class is not merely full. */
  @Test
  public void status_reflects_cancellation_then_closure() {
    assertEquals("open", PopulateRecruitmentCoursesJob.statusOf(UcsbSection.builder().build()));
    assertEquals(
        "closed",
        PopulateRecruitmentCoursesJob.statusOf(UcsbSection.builder().classClosed("Y").build()));
    assertEquals(
        "cancelled",
        PopulateRecruitmentCoursesJob.statusOf(
            UcsbSection.builder().courseCancelled("Y").classClosed("Y").build()));
    assertEquals(
        "open",
        PopulateRecruitmentCoursesJob.statusOf(UcsbSection.builder().classClosed(" ").build()));
  }

  // ---- failure and cancellation ----

  @Test
  public void an_api_failure_is_logged_and_rethrown() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenThrow(new RuntimeException("upstream 500"));

    assertThrows(RuntimeException.class, () -> job(RecruitmentType.TA).accept(ctx));
    assertTrue(jobStarted.getLog().contains("Error fetching offerings for 20261"));
  }

  @Test
  public void the_api_is_rate_limited() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261")).thenReturn(List.of());

    job(RecruitmentType.TA).accept(ctx);

    verify(jobRateLimit, times(1)).sleep();
  }

  @Test
  public void cancellation_propagates() throws Exception {
    JobContext cancelling = org.mockito.Mockito.mock(JobContext.class);
    org.mockito.Mockito.doThrow(new RuntimeException("cancelled"))
        .when(cancelling)
        .checkCancellation();
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));

    assertThrows(RuntimeException.class, () -> job(RecruitmentType.TA).accept(cancelling));
    verify(ucsbCurriculumService, never()).getOfferings(any(), any());
  }

  /** An offering whose id will not parse is skipped rather than crashing the run. */
  @Test
  public void an_offering_with_a_null_course_id_is_skipped() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                UcsbCourseOffering.builder()
                    .courseId(null)
                    .classSections(List.of(section("07492", "0100", "CONRAD P")))
                    .build()));

    job(RecruitmentType.TA).accept(ctx);

    verify(recruitmentCourseRepository, never()).save(any());
  }

  /** A meeting entry with no begin time yields no time string rather than "null - null". */
  @Test
  public void a_time_location_without_a_begin_time_yields_no_time() {
    UcsbSection s =
        UcsbSection.builder()
            .timeLocations(List.of(UcsbTimeLocation.builder().days("M W").build()))
            .build();

    assertNull(PopulateRecruitmentCoursesJob.firstTime(s));
    assertEquals("M W", PopulateRecruitmentCoursesJob.firstDays(s));
  }

  /** The opening and per-section log lines are what make the Jobs page useful; pin both. */
  @Test
  public void the_log_names_the_recruitment_and_each_section_it_writes() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering(
                    "CMPSC   156  ",
                    section("07492", "0100", "CONRAD P"),
                    section("07500", "0200", "SOMEONE ELSE"))));

    job(RecruitmentType.TA).accept(ctx);

    String log = jobStarted.getLog();
    assertTrue(
        log.contains("Populating TA recruitment for 20261: 1 course(s) flagged for TA"), log);
    assertTrue(log.contains("CMPSC   156 section 0100"), log);
    assertTrue(log.contains("CMPSC   156 section 0200"), log);
    assertTrue(log.contains("Finished: 2 added, 0 updated, 0 left removed"), log);
  }

  /**
   * A long run has to stay cancellable once it is already walking offerings, not merely before the
   * fetch, so the check inside the loop matters on its own.
   */
  @Test
  public void cancellation_is_checked_while_walking_offerings() throws Exception {
    when(courseRepository.findAll()).thenReturn(List.of(course("CMPSC   156", true, false)));
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(List.of(offering("CMPSC   156  ", section("07492", "0100", "CONRAD P"))));

    JobContext cancelling = org.mockito.Mockito.mock(JobContext.class);
    java.util.concurrent.atomic.AtomicInteger calls =
        new java.util.concurrent.atomic.AtomicInteger();
    org.mockito.Mockito.doAnswer(
            invocation -> {
              // Let the pre-fetch check pass; cancel once inside the offering loop.
              if (calls.incrementAndGet() > 1) {
                throw new RuntimeException("cancelled");
              }
              return null;
            })
        .when(cancelling)
        .checkCancellation();

    assertThrows(RuntimeException.class, () -> job(RecruitmentType.TA).accept(cancelling));
    verify(recruitmentCourseRepository, never()).save(any());
  }
}
