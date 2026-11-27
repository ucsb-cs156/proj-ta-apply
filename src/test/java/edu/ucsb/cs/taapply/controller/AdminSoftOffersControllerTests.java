package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.HiringField;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.models.HiringRecordDto;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.HiringRecordsService;
import edu.ucsb.cs.taapply.services.SoftOffersService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
  @MockitoBean HiringRecordsService hiringRecordsService;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static final String HIRING = "/api/admin/softOffers/hiring";

  /** Issue #509: Ada's row has a hiring record with one box ticked and the dropdown chosen. */
  private static HiringRecord hiringRecord() {
    return HiringRecord.builder()
        .id(3L)
        .applicationId(7L)
        .formalOfferSentAt(LocalDateTime.of(2025, 10, 22, 14, 5))
        .newHireForm(NewHireForm.DONE)
        .newHireFormAt(LocalDateTime.of(2025, 10, 23, 9, 0))
        .fundingSource("TA")
        .staffComments("Call HR")
        .updatedAt(LocalDateTime.of(2025, 10, 23, 9, 0))
        .updatedByEmail("staff@ucsb.edu")
        .build();
  }

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
        List.of(7L),
        Map.of(7L, HiringRecordDto.of(hiringRecord())),
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

  /** Issue #505: hiring staff get the results and the CSV, the same as an admin. */
  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_get_the_results_and_the_csv() throws Exception {
    when(recruitmentRepository.findById(5L)).thenReturn(Optional.of(ULA));
    when(softOffersService.results(ULA)).thenReturn(results());
    when(softOffersService.resultsCsv(ULA)).thenReturn("\"a\"\n");

    mockMvc.perform(get("/api/admin/softOffers?recruitmentId=5")).andExpect(status().isOk());
    mockMvc.perform(get("/api/admin/softOffers/csv?recruitmentId=5")).andExpect(status().isOk());
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

  /** Issue #509: each row's application id, and the hiring records by application id. */
  @WithMockUser(roles = {"HIRING_STAFF"})
  @Test
  public void the_results_carry_the_rows_application_ids_and_their_hiring_records()
      throws Exception {
    when(recruitmentRepository.findById(5L)).thenReturn(Optional.of(ULA));
    when(softOffersService.results(ULA)).thenReturn(results());

    mockMvc
        .perform(get("/api/admin/softOffers?recruitmentId=5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.applicationIds[0]").value(7))
        .andExpect(jsonPath("$.hiring.7.applicationId").value(7))
        .andExpect(jsonPath("$.hiring.7.formalOfferSentAt").value("2025-10-22T14:05:00"))
        .andExpect(jsonPath("$.hiring.7.formalOfferAcceptedAt").value((Object) null))
        .andExpect(jsonPath("$.hiring.7.newHireForm").value("DONE"))
        .andExpect(jsonPath("$.hiring.7.newHireFormAt").value("2025-10-23T09:00:00"))
        .andExpect(jsonPath("$.hiring.7.fundingSource").value("TA"))
        .andExpect(jsonPath("$.hiring.7.staffComments").value("Call HR"))
        .andExpect(jsonPath("$.hiring.7.updatedByEmail").value("staff@ucsb.edu"));
  }

  // ---- issue #509: PUT /api/admin/softOffers/hiring ----

  @Test
  public void logged_out_users_cannot_save_a_hiring_field() throws Exception {
    mockMvc
        .perform(
            put(HIRING)
                .param("applicationId", "7")
                .param("field", "FORMAL_OFFER_SENT")
                .param("value", "true")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(hiringRecordsService, never()).update(any(), any(), any());
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void users_and_instructors_cannot_save_a_hiring_field() throws Exception {
    mockMvc
        .perform(
            put(HIRING)
                .param("applicationId", "7")
                .param("field", "FORMAL_OFFER_SENT")
                .param("value", "true")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(hiringRecordsService, never()).update(any(), any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_saves_a_hiring_field_and_gets_the_record_back() throws Exception {
    when(hiringRecordsService.update(7L, HiringField.FORMAL_OFFER_SENT, "true"))
        .thenReturn(hiringRecord());

    MvcResult response =
        mockMvc
            .perform(
                put(HIRING)
                    .param("applicationId", "7")
                    .param("field", "FORMAL_OFFER_SENT")
                    .param("value", "true")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(HiringRecordDto.of(hiringRecord())),
        response.getResponse().getContentAsString());
    verify(hiringRecordsService).update(7L, HiringField.FORMAL_OFFER_SENT, "true");
  }

  /** Issue #509: hiring staff may edit too; the value may be left out, which clears a field. */
  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_save_a_hiring_field_and_may_send_no_value() throws Exception {
    HiringRecord cleared = hiringRecord();
    cleared.setNewHireForm(null);
    cleared.setNewHireFormAt(null);
    when(hiringRecordsService.update(7L, HiringField.NEW_HIRE_FORM, null)).thenReturn(cleared);

    mockMvc
        .perform(
            put(HIRING).param("applicationId", "7").param("field", "NEW_HIRE_FORM").with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.newHireForm").value((Object) null))
        .andExpect(jsonPath("$.newHireFormAt").value((Object) null))
        .andExpect(jsonPath("$.fundingSource").value("TA"));
    verify(hiringRecordsService).update(7L, HiringField.NEW_HIRE_FORM, null);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void saving_for_an_unknown_application_is_a_404() throws Exception {
    when(hiringRecordsService.update(9L, HiringField.IN_UCPATH, "true"))
        .thenThrow(new EntityNotFoundException(Application.class, 9L));

    MvcResult response =
        mockMvc
            .perform(
                put(HIRING)
                    .param("applicationId", "9")
                    .param("field", "IN_UCPATH")
                    .param("value", "true")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Application with id 9 not found", responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_value_the_field_does_not_take_is_a_400_and_so_is_an_unknown_field()
      throws Exception {
    when(hiringRecordsService.update(7L, HiringField.I9_COMPLETE, "yes"))
        .thenThrow(new IllegalArgumentException(HiringRecordsService.CHECKBOX_VALUE));

    MvcResult response =
        mockMvc
            .perform(
                put(HIRING)
                    .param("applicationId", "7")
                    .param("field", "I9_COMPLETE")
                    .param("value", "yes")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();
    assertEquals(HiringRecordsService.CHECKBOX_VALUE, responseToJson(response).get("message"));

    mockMvc
        .perform(
            put(HIRING)
                .param("applicationId", "7")
                .param("field", "SHOE_SIZE")
                .param("value", "true")
                .with(csrf()))
        .andExpect(status().isBadRequest());
    // Only the first PUT reached the service; the unknown field was refused before it.
    verify(hiringRecordsService, times(1)).update(any(), any(), any());
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
