package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.SoftOffersService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

/** Issue #487: the admin's soft offer results and their CSV, over a mocked service. */
@WebMvcTest(controllers = AdminSoftOffersController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class AdminSoftOffersControllerTests extends ControllerTestCase {

  @MockitoBean SoftOffersService softOffersService;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static final Recruitment ULA =
      Recruitment.builder()
          .id(5L)
          .quarter("20254")
          .type(RecruitmentType.ULA)
          .assignmentsPublished(true)
          .softOffersReleasedAt(LocalDateTime.of(2025, 10, 20, 9, 30))
          .softOfferDeadline(LocalDateTime.of(2025, 10, 25, 17, 0))
          .build();

  private static SoftOffersService.Results results() {
    return new SoftOffersService.Results(
        5L,
        "20254",
        ULA.getSoftOffersReleasedAt(),
        ULA.getSoftOfferDeadline(),
        new SoftOffersService.Counts(1, 1, 0, 0),
        SoftOffersService.RESULTS_HEADERS,
        List.of(
            List.of(
                "Ada",
                "Lovelace",
                "ada@ucsb.edu",
                "CMPSC 156",
                "CONRAD P",
                "phtcon@ucsb.edu",
                "yes",
                "Proceed",
                "2025-10-21T08:05",
                "Yes!")),
        SoftOffersService.UNASSIGNED_HEADERS,
        List.of());
  }

  @Test
  public void logged_out_users_are_refused() throws Exception {
    mockMvc.perform(get("/api/admin/softOffers?recruitmentId=5")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/softOffers/csv?recruitmentId=5")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void instructors_are_refused_the_results_hold_student_comments() throws Exception {
    mockMvc.perform(get("/api/admin/softOffers?recruitmentId=5")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/softOffers/csv?recruitmentId=5")).andExpect(status().is(403));
    verify(softOffersService, never()).results(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_gets_the_results() throws Exception {
    when(recruitmentRepository.findById(5L)).thenReturn(Optional.of(ULA));
    when(softOffersService.results(ULA)).thenReturn(results());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/softOffers?recruitmentId=5"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(results()), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_recruitment_is_a_404_and_a_refusal_a_400() throws Exception {
    when(recruitmentRepository.findById(9L)).thenReturn(Optional.empty());
    MvcResult missing =
        mockMvc
            .perform(get("/api/admin/softOffers?recruitmentId=9"))
            .andExpect(status().isNotFound())
            .andReturn();
    assertEquals("Recruitment with id 9 not found", responseToJson(missing).get("message"));

    when(recruitmentRepository.findById(5L)).thenReturn(Optional.of(ULA));
    when(softOffersService.results(ULA))
        .thenThrow(new IllegalArgumentException(SoftOffersService.NOT_RELEASED));
    MvcResult refused =
        mockMvc
            .perform(get("/api/admin/softOffers?recruitmentId=5"))
            .andExpect(status().isBadRequest())
            .andReturn();
    assertEquals(SoftOffersService.NOT_RELEASED, responseToJson(refused).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_csv_is_an_attachment_named_after_the_recruitment() throws Exception {
    when(recruitmentRepository.findById(5L)).thenReturn(Optional.of(ULA));
    when(softOffersService.resultsCsv(ULA)).thenReturn("\"First name\"\n\"Ada\"\n");

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/softOffers/csv?recruitmentId=5"))
            .andExpect(status().isOk())
            .andExpect(
                header()
                    .string("Content-Disposition", "attachment; filename=\"soft-offers-5.csv\""))
            .andReturn();

    assertEquals("text/csv;charset=UTF-8", response.getResponse().getContentType());
    assertEquals("\"First name\"\n\"Ada\"\n", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_csv_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(9L)).thenReturn(Optional.empty());
    mockMvc
        .perform(get("/api/admin/softOffers/csv?recruitmentId=9"))
        .andExpect(status().isNotFound());
    verify(softOffersService, never()).resultsCsv(any());
  }
}
