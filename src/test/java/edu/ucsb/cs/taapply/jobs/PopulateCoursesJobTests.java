package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import edu.ucsb.cs.taapply.repository.CourseRepository;
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

@SpringBootTest(classes = PopulateCoursesJobTests.class)
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class PopulateCoursesJobTests {

  @Mock private UCSBCurriculumService ucsbCurriculumService;
  @Mock private CourseRepository courseRepository;
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
        .jobRateLimit(jobRateLimit)
        .build();
  }

  private static UcsbCourse ucsb(String courseId, String title) {
    return UcsbCourse.builder().courseId(courseId).title(title).build();
  }

  @Test
  public void inserts_new_courses_with_both_flags_false() throws Exception {
    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC 156")).thenReturn(Optional.empty());

    job("20241", "20241", "U").accept(ctx);

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository).save(captor.capture());
    Course saved = captor.getValue();
    assertEquals("CMPSC 156", saved.getCourseId());
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
            .courseId("CMPSC 156")
            .title("Old Title")
            .needsTa(true)
            .needsUla(true)
            .build();

    when(ucsbCurriculumService.getCourses("CMPSC", "20241", "U"))
        .thenReturn(List.of(ucsb("CMPSC   156", "ADV APP PROGRAM")));
    when(courseRepository.findByCourseId("CMPSC 156")).thenReturn(Optional.of(existing));

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
    when(courseRepository.findByCourseId("CMPSC 156")).thenReturn(Optional.empty());

    job("20241", "20242", "U").accept(ctx);

    // The good quarter still saved its course.
    verify(courseRepository).save(any());
    assertTrue(jobStarted.getLog().contains("Error fetching 20241"));
    assertTrue(jobStarted.getLog().contains("1 quarter(s) failed"));
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
    when(courseRepository.findByCourseId("CMPSC 156")).thenReturn(Optional.empty());
    when(courseRepository.findByCourseId("CMPSC 130A"))
        .thenReturn(Optional.of(Course.builder().courseId("CMPSC 130A").title("Old").build()));

    job("20241", "20241", "U").accept(ctx);

    String log = jobStarted.getLog();
    assertTrue(log.contains("Populating CMPSC courses at level U"));
    assertTrue(log.contains("Fetching CMPSC 20241 level U"));
    assertTrue(log.contains("1 added, 1 updated"));
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
