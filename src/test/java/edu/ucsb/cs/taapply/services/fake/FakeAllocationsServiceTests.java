package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.AllocationVisibilityService;
import edu.ucsb.cs.taapply.services.fake.FakeAllocationsService.Estimates;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {FakeAllocationsService.class})
@ActiveProfiles("test")
public class FakeAllocationsServiceTests {

  @Autowired FakeAllocationsService service;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean AllocationService allocationService;
  @MockitoBean AllocationVisibilityService allocationVisibilityService;

  private Recruitment recruitment;
  private RecruitmentCourse withNumbers; // max 300, enrollment 250
  private RecruitmentCourse withoutNumbers; // neither known
  private RecruitmentCourse removed;
  private List<RecruitmentCourse> allocated;

  private static RecruitmentCourse course(
      long id, Integer max, Integer enrollment, Integer estimate, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId("CMPSC " + id)
        .enrollCode("EC" + id)
        .maxEnroll(max)
        .enrollment(enrollment)
        .enrollmentEstimate(estimate)
        .removed(removed)
        .build();
  }

  @BeforeEach
  public void setup() {
    recruitment = Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();
    withNumbers = course(1L, 300, 250, 111, false);
    withoutNumbers = course(2L, null, null, 222, false);
    removed = course(3L, 999, 999, 333, true);
    allocated = List.of(withNumbers, withoutNumbers);
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(withNumbers, withoutNumbers, removed));
    when(allocationService.autoAllocate(recruitment)).thenReturn(allocated);
  }

  @Test
  public void it_sets_the_target_fills_estimates_from_the_maximum_and_allocates_in_order() {
    List<RecruitmentCourse> result = service.fake(7L, 5, Estimates.MAX, false);

    assertSame(allocated, result);
    assertEquals(5, recruitment.getTotalHiringTarget());
    assertEquals(300, withNumbers.getEnrollmentEstimate());
    // A course with no figure keeps the estimate it had; a removed one is never touched.
    assertEquals(222, withoutNumbers.getEnrollmentEstimate());
    assertEquals(333, removed.getEnrollmentEstimate());
    InOrder inOrder =
        inOrder(recruitmentRepository, recruitmentCourseRepository, allocationService);
    inOrder.verify(recruitmentRepository).save(recruitment);
    inOrder.verify(recruitmentCourseRepository).save(withNumbers);
    inOrder.verify(allocationService).autoAllocate(recruitment);
    verify(recruitmentCourseRepository, never()).save(withoutNumbers);
    verify(recruitmentCourseRepository, never()).save(removed);
  }

  @Test
  public void it_can_fill_estimates_from_the_current_enrollment() {
    service.fake(7L, 5, Estimates.ACTUAL, false);

    assertEquals(250, withNumbers.getEnrollmentEstimate());
    assertEquals(222, withoutNumbers.getEnrollmentEstimate());
    verify(recruitmentCourseRepository).save(withNumbers);
  }

  @Test
  public void it_can_keep_the_estimates_already_entered() {
    service.fake(7L, 5, Estimates.KEEP, false);

    assertEquals(111, withNumbers.getEnrollmentEstimate());
    assertEquals(222, withoutNumbers.getEnrollmentEstimate());
    verify(recruitmentCourseRepository, never()).save(any());
    verify(allocationService).autoAllocate(recruitment);
  }

  @Test
  public void it_leaves_visibility_alone_unless_asked() {
    service.fake(7L, 5, Estimates.KEEP, false);

    verify(allocationVisibilityService, never()).change(any(), any());
  }

  @Test
  public void it_lets_each_faculty_member_see_their_own_courses_after_allocating_when_asked() {
    service.fake(7L, 5, Estimates.KEEP, true);

    InOrder inOrder = inOrder(allocationService, allocationVisibilityService);
    inOrder.verify(allocationService).autoAllocate(recruitment);
    inOrder
        .verify(allocationVisibilityService)
        .change(recruitment, AllocationVisibility.OWN_COURSES);
  }

  @Test
  public void the_largest_target_is_three_per_course_and_the_smallest_is_one() {
    // Two non-removed courses: 1 to 6.
    service.fake(7L, 6, Estimates.KEEP, false);
    assertEquals(6, recruitment.getTotalHiringTarget());
    service.fake(7L, 1, Estimates.KEEP, false);
    assertEquals(1, recruitment.getTotalHiringTarget());
    assertEquals(3, FakeAllocationsService.MAX_TARGET_PER_COURSE);
  }

  @Test
  public void a_target_above_three_per_course_is_refused_and_nothing_changes() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> service.fake(7L, 7, Estimates.MAX, true));

    assertEquals("hiringTarget must be between 1 and 6", e.getMessage());
    verify(recruitmentRepository, never()).save(any());
    verify(allocationService, never()).autoAllocate(any());
  }

  @Test
  public void a_target_below_one_is_refused() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> service.fake(7L, 0, Estimates.MAX, false));

    assertEquals("hiringTarget must be between 1 and 6", e.getMessage());
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void a_recruitment_with_only_removed_courses_is_refused() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(removed));

    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> service.fake(7L, 1, Estimates.MAX, false));

    assertEquals("This recruitment has no courses to allocate to", e.getMessage());
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void an_unknown_recruitment_is_not_found() {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    EntityNotFoundException e =
        assertThrows(
            EntityNotFoundException.class, () -> service.fake(99L, 1, Estimates.MAX, false));

    assertEquals("Recruitment with id 99 not found", e.getMessage());
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void the_estimate_choices_are_max_actual_and_keep() {
    assertEquals(
        List.of(Estimates.MAX, Estimates.ACTUAL, Estimates.KEEP), List.of(Estimates.values()));
  }
}
