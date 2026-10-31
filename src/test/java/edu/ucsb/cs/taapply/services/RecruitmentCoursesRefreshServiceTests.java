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
import org.junit.jupiter.api.Test;
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
        .enrollment(10)
        .maxEnroll(20)
        .status("open")
        .removed(removed)
        .stale(false)
        .allocation(3)
        .enrollmentEstimate(15)
        .build();
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
    assertEquals(118, row.getEnrollment());
    assertEquals(150, row.getMaxEnroll());
    assertEquals("CONRAD P", row.getInstructor());
    assertEquals("ADV APP PROGRAM", row.getTitle());
    assertEquals(7L, row.getRecruitmentId());
    // The admin's own fields survive a refresh.
    assertEquals(3, row.getAllocation());
    assertEquals(15, row.getEnrollmentEstimate());
    assertFalse(row.isRemoved());
    assertFalse(row.isStale());
    verify(recruitmentCourseRepository, times(1)).save(row);
    // The page's "last refreshed" line reads this stamp.
    assertNotNull(recruitment.getLastPopulatedAt());
    verify(recruitmentRepository, times(1)).save(recruitment);
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
    assertEquals(10, removed.getEnrollment());
    assertEquals("OLD NAME", removed.getInstructor());
    assertEquals(10, gone.getEnrollment());
    assertFalse(gone.isStale());
    verify(recruitmentCourseRepository, never()).save(any());
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
    assertEquals(99, row.getEnrollment());
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
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
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
