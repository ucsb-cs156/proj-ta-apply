package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.UpstreamApiException;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {RecruitmentCoursesRefreshService.class})
@ActiveProfiles("test")
public class RecruitmentCoursesRefreshServiceTests {

  @Autowired RecruitmentCoursesRefreshService service;
  @MockitoBean UCSBCurriculumService ucsbCurriculumService;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  // isFresh answers false unless a test says otherwise, so the API is called.
  @MockitoBean BudgetCourseService budgetCourseService;

  private static Recruitment recruitment() {
    return Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();
  }

  private static RecruitmentCourse row(long id, String enrollCode, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId("CMPSC   156")
        .enrollCode(enrollCode)
        .section("0100")
        .instructor("OLD NAME")
        .status("open")
        .removed(removed)
        .stale(false)
        .allocation(3)
        .build();
  }

  /** The sections the service handed the cache, by enroll code. */
  @SuppressWarnings("unchecked")
  private Map<String, UcsbSection> cachedSections(List<RecruitmentCourse> rows) {
    ArgumentCaptor<Map<String, UcsbSection>> captor = ArgumentCaptor.forClass(Map.class);
    verify(budgetCourseService)
        .refreshCache(
            org.mockito.ArgumentMatchers.eq("20261"),
            org.mockito.ArgumentMatchers.eq(rows),
            captor.capture());
    return captor.getValue();
  }

  private static UcsbSection section(String enrollCode, String number, int enrolled, int max) {
    return UcsbSection.builder()
        .enrollCode(enrollCode)
        .section(number)
        .enrolledTotal(enrolled)
        .maxEnroll(max)
        .instructors(List.of(UcsbInstructor.builder().instructor("CONRAD P").build()))
        .timeLocations(new ArrayList<>())
        .build();
  }

  private static UcsbCourseOffering offering(String courseId, UcsbSection... sections) {
    return UcsbCourseOffering.builder()
        .courseId(courseId)
        .title("ADV APP PROGRAM")
        .classSections(List.of(sections))
        .build();
  }

  @Test
  public void rewrites_offering_details_and_keeps_the_admins_own_fields() throws Exception {
    Recruitment recruitment = recruitment();
    RecruitmentCourse row = row(1L, "07492", false);
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering(
                    "CMPSC 156  ",
                    section("07492", "0100", 118, 150),
                    // A discussion section: never a row.
                    section("07500", "0101", 30, 30))));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(row));

    int refreshed = service.refresh(recruitment);

    assertEquals(1, refreshed);
    assertEquals("CONRAD P", row.getInstructor());
    assertEquals("ADV APP PROGRAM", row.getTitle());
    assertEquals(7L, row.getRecruitmentId());
    // The admin's own fields survive a refresh.
    assertEquals(3, row.getAllocation());
    assertFalse(row.isRemoved());
    assertFalse(row.isStale());
    verify(recruitmentCourseRepository, times(1)).save(row);
    // The enrollment figures go to the quarter's cache (issue #363), lectures only.
    Map<String, UcsbSection> cached = cachedSections(List.of(row));
    assertEquals(1, cached.size());
    assertEquals(118, cached.get("07492").getEnrolledTotal());
    assertEquals(150, cached.get("07492").getMaxEnroll());
    // The page's "last refreshed" line reads this stamp.
    assertNotNull(recruitment.getLastPopulatedAt());
    verify(recruitmentRepository, times(1)).save(recruitment);
  }

  /** Issue #363: figures checked within the time to live are served as they are. */
  @Test
  public void fresh_figures_mean_no_api_call_no_writes_and_no_stamp() throws Exception {
    Recruitment recruitment = recruitment();
    RecruitmentCourse live = row(1L, "07492", false);
    RecruitmentCourse removed = row(2L, "07500", true);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(live, removed));
    // Only the rows the page shows have to be fresh.
    when(budgetCourseService.isFresh("20261", List.of(live))).thenReturn(true);

    assertEquals(0, service.refresh(recruitment));

    verify(ucsbCurriculumService, never()).getOfferings(any(), any());
    verify(budgetCourseService, never()).refreshCache(any(), any(), any());
    verify(recruitmentCourseRepository, never()).save(any());
    assertNull(recruitment.getLastPopulatedAt());
    verify(recruitmentRepository, never()).save(any());
  }

  /** The one fetch is for the whole quarter: the other recruitment's sections are cached too. */
  @Test
  public void every_lecture_the_api_returns_reaches_the_cache_not_only_this_recruitments()
      throws Exception {
    RecruitmentCourse row = row(1L, "07492", false);
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC 156  ", section("07492", "0100", 118, 150)),
                offering("CMPSC 130A ", section("07600", "0100", 80, 90))));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(row));

    service.refresh(recruitment());

    Map<String, UcsbSection> cached = cachedSections(List.of(row));
    assertEquals(2, cached.size());
    assertEquals(80, cached.get("07600").getEnrolledTotal());
  }

  /**
   * It neither adds rows for lectures it has no row for, nor touches rows the API no longer has.
   */
  @Test
  public void leaves_removed_rows_and_rows_no_longer_offered_alone_and_adds_nothing()
      throws Exception {
    RecruitmentCourse removed = row(1L, "07492", true);
    RecruitmentCourse gone = row(2L, "09999", false);
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering("CMPSC 156  ", section("07492", "0100", 118, 150)),
                offering("CMPSC 130A ", section("07600", "0100", 80, 90))));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(removed, gone));

    int refreshed = service.refresh(recruitment());

    assertEquals(0, refreshed);
    assertEquals("OLD NAME", removed.getInstructor());
    assertEquals("OLD NAME", gone.getInstructor());
    assertFalse(gone.isStale());
    verify(recruitmentCourseRepository, never()).save(any());
    // Nothing of this recruitment's was applied, but the quarter's cache still gets the fetch.
    assertEquals(2, cachedSections(List.of()).size());
    verify(recruitmentRepository, times(1)).save(any());
  }

  @Test
  public void skips_offerings_without_a_course_id_or_sections_or_enroll_code() throws Exception {
    RecruitmentCourse row = row(1L, "07492", false);
    UcsbSection noCode = section(null, "0100", 1, 1);
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261"))
        .thenReturn(
            List.of(
                offering(null, section("07492", "0100", 118, 150)),
                UcsbCourseOffering.builder().courseId("CMPSC 8   ").classSections(null).build(),
                offering("CMPSC 9   ", noCode),
                offering("CMPSC 156  ", section("07492", "0100", 99, 100))));
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(row));

    assertEquals(1, service.refresh(recruitment()));
    Map<String, UcsbSection> cached = cachedSections(List.of(row));
    assertEquals(1, cached.size());
    assertEquals(99, cached.get("07492").getEnrolledTotal());
  }

  @Test
  public void a_failed_api_call_changes_nothing_and_is_an_upstream_error() throws Exception {
    Recruitment recruitment = recruitment();
    RuntimeException cause = new RuntimeException("timeout");
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261")).thenThrow(cause);

    UpstreamApiException thrown =
        assertThrows(UpstreamApiException.class, () -> service.refresh(recruitment));

    assertEquals(
        "The UCSB API could not be reached; the stored enrollment figures were kept.",
        thrown.getMessage());
    assertSame(cause, thrown.getCause());
    assertNull(recruitment.getLastPopulatedAt());
    verify(budgetCourseService, never()).refreshCache(any(), any(), any());
    verify(recruitmentCourseRepository, never()).save(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void an_empty_answer_refreshes_nothing_but_still_counts_as_a_refresh() throws Exception {
    Recruitment recruitment = recruitment();
    when(ucsbCurriculumService.getOfferings("CMPSC", "20261")).thenReturn(List.of());
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(row(1L, "07492", false)));

    assertEquals(0, service.refresh(recruitment));
    assertTrue(recruitment.getLastPopulatedAt() != null);
    verify(recruitmentCourseRepository, never()).save(any());
  }
}
