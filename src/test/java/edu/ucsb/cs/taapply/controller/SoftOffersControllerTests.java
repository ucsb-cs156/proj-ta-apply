package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.models.SoftOfferDto;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.SoftOffersService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

/** Issue #486: the applicant's soft offers endpoints, over a mocked service. */
@WebMvcTest(controllers = SoftOffersController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class SoftOffersControllerTests extends ControllerTestCase {

  @MockitoBean SoftOffersService softOffersService;
  @MockitoBean UserRepository userRepository;

  private static final String GRAD_EMAIL = "grad@example.org";
  private static final String RESPOND = "/api/softOffers/respond?applicationId=5&decision=PROCEED";

  private static SoftOfferDto offer() {
    return new SoftOfferDto(
        2L,
        "20264",
        5L,
        LocalDateTime.of(2026, 11, 20, 9, 30),
        LocalDateTime.of(2026, 11, 25, 17, 0),
        new SoftOfferDto.Notice(3L, "# Welcome"),
        new SoftOfferDto.Course(
            10L, "CMPSC 156", "0100", "ADV APP PROGRAM", "CONRAD P", null, "T R", "14:00", "15:15"),
        List.of(new SoftOfferDto.Meeting("0101", "W", "09:00", "09:50")),
        null);
  }

  @Test
  public void logged_out_users_are_refused() throws Exception {
    mockMvc.perform(get("/api/softOffers/mine")).andExpect(status().is(403));
    mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().is(403));
    verify(softOffersService, never()).respond(any(), any(), any(), any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void mine_is_the_current_users_offers() throws Exception {
    when(softOffersService.mine(GRAD_EMAIL)).thenReturn(List.of(offer()));

    MvcResult response =
        mockMvc.perform(get("/api/softOffers/mine")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(offer())), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void respond_passes_the_current_user_the_choice_and_the_comments() throws Exception {
    SoftOfferResponse saved =
        SoftOfferResponse.builder()
            .id(77L)
            .applicationId(5L)
            .recruitmentCourseId(10L)
            .decision(SoftOfferDecision.PROCEED)
            .comments("Thanks")
            .build();
    when(softOffersService.respond(GRAD_EMAIL, 5L, SoftOfferDecision.PROCEED, "Thanks"))
        .thenReturn(saved);

    MvcResult response =
        mockMvc
            .perform(
                post(RESPOND)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"comments\":\"Thanks\"}")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void respond_without_a_body_passes_null_comments() throws Exception {
    when(softOffersService.respond(GRAD_EMAIL, 5L, SoftOfferDecision.PROCEED, null))
        .thenReturn(SoftOfferResponse.builder().id(1L).build());

    mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().isOk());

    verify(softOffersService).respond(GRAD_EMAIL, 5L, SoftOfferDecision.PROCEED, null);
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void an_answer_already_given_is_a_409() throws Exception {
    when(softOffersService.respond(any(), any(), any(), any()))
        .thenThrow(new IllegalStateException("This soft offer has already been answered."));

    MvcResult response =
        mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().isConflict()).andReturn();

    assertEquals(
        "This soft offer has already been answered.", responseToJson(response).get("message"));
    assertEquals("IllegalStateException", responseToJson(response).get("type"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void the_services_refusals_keep_their_statuses() throws Exception {
    when(softOffersService.respond(any(), any(), any(), any()))
        .thenThrow(
            new IllegalArgumentException("There is no soft offer open for this application."),
            new ForbiddenException("That application belongs to someone else"),
            new EntityNotFoundException(edu.ucsb.cs.taapply.entity.Application.class, 5L));

    MvcResult bad =
        mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().isBadRequest()).andReturn();
    assertEquals(
        "There is no soft offer open for this application.", responseToJson(bad).get("message"));
    mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().isForbidden());
    mockMvc.perform(post(RESPOND).with(csrf())).andExpect(status().isNotFound());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_missing_or_unknown_decision_is_a_400() throws Exception {
    mockMvc
        .perform(post("/api/softOffers/respond?applicationId=5").with(csrf()))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(post("/api/softOffers/respond?applicationId=5&decision=MAYBE").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(softOffersService, never()).respond(any(), any(), any(), any());
  }
}
