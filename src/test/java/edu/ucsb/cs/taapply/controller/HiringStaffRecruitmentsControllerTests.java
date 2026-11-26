package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = HiringStaffRecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class HiringStaffRecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static Recruitment recruitment(long id, String quarter, RecruitmentType type) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(ApplicationStatus.CLOSED)
        .reviewStatus("Closed")
        .build();
  }

  /** A ULA recruitment with soft offers released; the newest quarter of the four below. */
  private static Recruitment releasedUla(long id, String quarter) {
    Recruitment r = recruitment(id, quarter, RecruitmentType.ULA);
    r.setAssignmentsPublished(true);
    r.setSoftOffersReleasedAt(LocalDateTime.of(2026, 11, 20, 9, 30));
    r.setSoftOfferDeadline(LocalDateTime.of(2026, 11, 25, 17, 0));
    return r;
  }

  private static final String URL = "/api/hiringStaff/recruitments";

  @Test
  public void logged_out_users_are_refused() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void students_and_instructors_are_refused() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_get_the_released_ula_recruitments_newest_first() throws Exception {
    Recruitment newer = releasedUla(4L, "20271");
    Recruitment older = releasedUla(1L, "20254");
    // The hidden one is included: hiding is from students and instructors (issue #496).
    older.setHidden(true);
    Recruitment unreleasedUla = recruitment(3L, "20264", RecruitmentType.ULA);
    unreleasedUla.setAssignmentsPublished(true);
    Recruitment ta = recruitment(2L, "20264", RecruitmentType.TA);
    ta.setAssignmentsPublished(true);
    // A TA recruitment never has soft offers, even with the fields somehow set.
    ta.setSoftOffersReleasedAt(LocalDateTime.of(2026, 11, 20, 9, 30));
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(newer, ta, unreleasedUla, older));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(newer, older)),
        response.getResponse().getContentAsString());
    assertTrue(HiringStaffRecruitmentsController.hasSoftOfferResults(newer));
    assertFalse(HiringStaffRecruitmentsController.hasSoftOfferResults(ta));
    assertFalse(HiringStaffRecruitmentsController.hasSoftOfferResults(unreleasedUla));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_may_read_it_too() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of());
    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();
    assertEquals("[]", response.getResponse().getContentAsString());
  }
}
