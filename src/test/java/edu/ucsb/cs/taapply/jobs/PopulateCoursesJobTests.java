package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import java.util.ArrayList;
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

@SpringBootTest(classes = PopulateCoursesJobTests.class)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class PopulateCoursesJobTests {

  @Mock private UCSBCurriculumService ucsbCurriculumService;
  @Mock private CourseRepository courseRepository;
  @Mock private CatalogNameRepository catalogNameRepository;
  @Mock private JobRateLimit jobRateLimit;

  private JobContext ctx;
  private Job jobStarted;

  @BeforeEach
  void setup() {
    jobStarted = Job.builder().build();
    ctx = new JobContext(null, jobStarted);
  }

  private PopulateCoursesJob job(String start, String end, String level) {
    return PopulateCoursesJob.builder()
        .startQuarterYYYYQ(start)
        .endQuarterYYYYQ(end)
        .level(level)
        .subjectArea("CMPSC")
        .ucsbCurriculumService(ucsbCurriculumService)
        .courseRepository(courseRepository)
        .catalogNameRepository(catalogNameRepository)
        .jobRateLimit(jobRateLimit)
        .build();
  }

  private static UcsbSection section(String number, String... instructorNames) {
    List<UcsbInstructor> instructors = new ArrayList<>();
    for (String name : instructorNames) {
      instructors.add(UcsbInstructor.builder().instructor(name).functionCode("Teaching").build());
    }
    return UcsbSection.builder().section(number).instructors(instructors).build();
  }

  private static UcsbCourseOffering offering(UcsbSection... sections) {
    return UcsbCourseOffering.builder()
        .courseId("CMPSC   156")
        .classSections(List.of(sections))
        .build();
  }

  // ---- catalog names (issue #120) ----

  @Test
  public void records_the_instructors_of_primary_sections_as_catalog_names() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U")).thenReturn(List.of());
    when(ucsbCurriculumService.getOfferings("CMPSC", "20241"))
        .thenReturn(
            List.of(
                offering(
                    section("0100", "CONRAD P", "GAUCHO C"),
                    section("0101", "TA ONE"),
                    section("0200", "CONRAD P")),
                offering(section("0100", "  ", null, "NEW Z "))));
    when(catalogNameRepository.existsById(any())).thenReturn(false);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);

    job("20241", "20241", "U").accept(ctx);

    // CONRAD P once (already saved by the time it appears again? no: existsById is mocked false,
    // so it is saved each time it is seen), GAUCHO C skipped as already there, TA ONE skipped as a
    // secondary, blanks skipped, NEW Z trimmed.
    verify(catalogNameRepository, times(2)).save(CatalogName.builder().name("CONRAD P").build());
    verify(catalogNameRepository, never()).save(CatalogName.builder().name("GAUCHO C").build());
    verify(catalogNameRepository, never()).save(CatalogName.builder().name("TA ONE").build());
    verify(catalogNameRepository, times(1)).save(CatalogName.builder().name("NEW Z").build());
    verify(catalogNameRepository, times(3)).save(any());
    assertTrue(jobStarted.getLog().contains("20241: 3 new catalog name(s)"));
    assertTrue(
        jobStarted
            .getLog()
            .contains(
                "Finished: 0 added, 0 updated, 3 catalog name(s) added, 0 quarter(s) failed"));
  }

  @Test
  public void a_failing_offerings_fetch_keeps_the_courses_and_continues() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC 156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.empty());
    when(ucsbCurriculumService.getOfferings("CMPSC", "20241"))
        .thenThrow(new RuntimeException("API down"));

    job("20241", "20241", "U").accept(ctx);

    verify(courseRepository, times(1)).save(any());
    verify(catalogNameRepository, never()).save(any());
    assertTrue(jobStarted.getLog().contains("Error fetching instructors for 20241: API down"));
    assertTrue(
        jobStarted.getLog().contains("Finished: 1 added, 0 updated, 0 catalog name(s) added"));
  }

  @Test
  public void offerings_without_sections_or_instructors_add_no_names() throws Exception {
    PopulateCoursesJob job = job("20241", "20241", "U");

    assertEquals(0, job.upsertCatalogNames(null));
    assertEquals(0, job.upsertCatalogNames(List.of()));
    assertEquals(
        0,
        job.upsertCatalogNames(
            List.of(
                UcsbCourseOffering.builder().courseId("CMPSC   156").classSections(null).build(),
                offering(UcsbSection.builder().section("0100").instructors(null).build()),
                offering(section("0100")))));
    verify(catalogNameRepository, never()).save(any());
  }

  private static UcsbCourse ucsb(String courseId, String title) {
    return UcsbCourse.builder().courseId(courseId).title(title).build();
  }

  @Test
  public void inserts_new_courses_with_both_flags_false() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.empty());

    job("20241", "20241", "U").accept(ctx);

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository).save(captor.capture());
    Course saved = captor.getValue();
    assertEquals("CMPSC   156", saved.getCourseId());
    assertEquals("ADV APP PROGRAM", saved.getTitle());
    assertEquals(false, saved.isNeedsTa());
    assertEquals(false, saved.isNeedsUla());
  }

  /**
   * The most important behavior in this iteration: the flags are admin-curated, so a re-run must
   * refresh the title without touching them.
   */
  @Test
  public void re_running_preserves_the_ta_and_ula_flags_on_an_existing_course() throws Exception {
    Course existing =
        Course.builder()
            .courseId("CMPSC   156")
            .title("Old Title")
            .needsTa(true)
            .needsUla(true)
            .build();

    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.of(existing));

    job("20241", "20241", "U").accept(ctx);

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository).save(captor.capture());
    Course saved = captor.getValue();
    assertEquals("ADV APP PROGRAM", saved.getTitle(), "title should be refreshed");
    assertTrue(saved.isNeedsTa(), "needsTa must survive a re-run");
    assertTrue(saved.isNeedsUla(), "needsUla must survive a re-run");
  }

  @Test
  public void never_deletes_anything() throws Exception {
    when(ucsbCurriculumService.getCourses(eq("CMPSC"), any(), eq("U")))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId(any())).thenReturn(Optional.empty());

    job("20241", "20244", "U").accept(ctx);

    verify(courseRepository, never()).delete(any());
    verify(courseRepository, never()).deleteAll();
    verify(courseRepository, never()).deleteById(any());
  }

  @Test
  public void walks_every_quarter_in_the_range() throws Exception {
    when(ucsbCurriculumService.getCourses(eq("CMPSC"), any(), eq("U"))).thenReturn(List.of());

    job("20244", "20252", "U").accept(ctx);

    verify(ucsbCurriculumService).getCourses("CMPSC", "20244", "U");
    verify(ucsbCurriculumService).getCourses("CMPSC", "20251", "U");
    verify(ucsbCurriculumService).getCourses("CMPSC", "20252", "U");
  }

  @Test
  public void rate_limits_between_quarters() throws Exception {
    when(ucsbCurriculumService.getCourses(eq("CMPSC"), any(), eq("U"))).thenReturn(List.of());

    job("20241", "20243", "U").accept(ctx);

    verify(jobRateLimit, org.mockito.Mockito.times(3)).sleep();
  }

  /** One bad quarter must not discard the quarters that already succeeded. */
  @Test
  public void a_failing_quarter_is_logged_and_the_run_continues() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenThrow(new RuntimeException("upstream 500"));
    when(ucsbCurriculumService.getCourses("CMPSC", "20242", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.empty());

    job("20241", "20242", "U").accept(ctx);

    // The good quarter still saved its course.
    verify(courseRepository).save(any());
    String log = jobStarted.getLog();
    assertTrue(log.contains("Error fetching 20241"), log);
    assertTrue(
        log.contains("Finished: 1 added, 0 updated, 0 catalog name(s) added, 1 quarter(s) failed"),
        log);
  }

  @Test
  public void skips_courses_with_a_blank_course_id() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("   ", "Blank"), ucsb(null, "Null")));

    job("20241", "20241", "U").accept(ctx);

    verify(courseRepository, never()).save(any());
  }

  @Test
  public void logs_a_summary_of_what_it_did() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM"), ucsb("CMPSC   130A", "Data")));
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.empty());
    when(courseRepository.findByCourseId("CMPSC   130A"))
        .thenReturn(Optional.of(Course.builder().courseId("CMPSC   130A").title("Old").build()));

    job("20241", "20241", "U").accept(ctx);

    String log = jobStarted.getLog();
    assertTrue(log.contains("Populating CMPSC courses at level U"));
    assertTrue(log.contains("Fetching CMPSC 20241 level U"));
    assertTrue(log.contains("  20241: 2 course(s) returned"), log);
    // Anchored on "Finished: " so a negated counter cannot slip through as a substring.
    assertTrue(
        log.contains("Finished: 1 added, 1 updated, 0 catalog name(s) added, 0 quarter(s) failed"),
        log);
  }

  @Test
  public void a_backwards_range_is_rejected_before_any_api_call() throws Exception {
    assertThrows(IllegalArgumentException.class, () -> job("20244", "20241", "U").accept(ctx));
    verify(ucsbCurriculumService, never()).getCourses(any(), any(), any());
  }

  @Test
  public void cancellation_propagates() throws Exception {
    JobContext cancelling = org.mockito.Mockito.mock(JobContext.class);
    doThrow(new RuntimeException("cancelled")).when(cancelling).checkCancellation();

    assertThrows(RuntimeException.class, () -> job("20241", "20241", "U").accept(cancelling));
    verify(ucsbCurriculumService, never()).getCourses(any(), any(), any());
  }
}
