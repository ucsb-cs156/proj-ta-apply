package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.FundingSource;
import edu.ucsb.cs.taapply.repository.FundingSourceRepository;
import edu.ucsb.cs.taapply.repository.HiringRecordRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

/** Issue #512, part 1: the Funding Sources table behind Admin → Funding Sources. */
@WebMvcTest(controllers = FundingSourcesController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class FundingSourcesControllerTests extends ControllerTestCase {

  @MockitoBean FundingSourceRepository fundingSourceRepository;
  @MockitoBean HiringRecordRepository hiringRecordRepository;

  private static final String ALL = "/api/admin/fundingSources/all";
  private static final String POST = "/api/admin/fundingSources/post";
  private static final String PUT = "/api/admin/fundingSources/put";
  private static final String DELETE = "/api/admin/fundingSources/delete";

  private static FundingSource sub0() {
    return FundingSource.builder().abbreviation("sub0").explanation("Temporary Sub Zero").build();
  }

  private static FundingSource dsGift() {
    return FundingSource.builder().abbreviation("ds-gift").explanation("Data Science Gift").build();
  }

  private String explanationBody(String explanation) throws Exception {
    return mapper.writeValueAsString(Map.of("explanation", explanation));
  }

  // ---- authorization: admins maintain the list; hiring staff may only read it ----

  @Test
  public void logged_out_users_cannot_get_all() throws Exception {
    mockMvc.perform(get(ALL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void users_and_instructors_cannot_get_all() throws Exception {
    mockMvc.perform(get(ALL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_can_get_all() throws Exception {
    when(fundingSourceRepository.findAll()).thenReturn(List.of(sub0()));

    MvcResult response = mockMvc.perform(get(ALL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(sub0())), response.getResponse().getContentAsString());
  }

  @Test
  public void logged_out_users_cannot_post() throws Exception {
    mockMvc
        .perform(post(POST + "?abbreviation=sub0&explanation=x").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_post() throws Exception {
    mockMvc
        .perform(post(POST + "?abbreviation=sub0&explanation=x").with(csrf()))
        .andExpect(status().is(403));
    verify(fundingSourceRepository, never()).save(any());
  }

  @Test
  public void logged_out_users_cannot_put() throws Exception {
    mockMvc
        .perform(
            put(PUT + "?abbreviation=sub0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(explanationBody("x"))
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_put() throws Exception {
    mockMvc
        .perform(
            put(PUT + "?abbreviation=sub0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(explanationBody("x"))
                .with(csrf()))
        .andExpect(status().is(403));
    verify(fundingSourceRepository, never()).save(any());
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc.perform(delete(DELETE + "?abbreviation=sub0").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_delete() throws Exception {
    mockMvc.perform(delete(DELETE + "?abbreviation=sub0").with(csrf())).andExpect(status().is(403));
    verify(fundingSourceRepository, never()).delete(any());
  }

  // ---- GET /all ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_the_list_sorted_by_abbreviation() throws Exception {
    FundingSource ta =
        FundingSource.builder()
            .abbreviation("ula-gift")
            .explanation("Gift funding for ULAs")
            .build();
    FundingSource dept =
        FundingSource.builder().abbreviation("ds-gift").explanation("Data Science Gift").build();
    when(fundingSourceRepository.findAll()).thenReturn(List.of(ta, sub0(), dept));

    MvcResult response = mockMvc.perform(get(ALL)).andExpect(status().isOk()).andReturn();

    verify(fundingSourceRepository, times(1)).findAll();
    assertEquals(
        mapper.writeValueAsString(List.of(dept, sub0(), ta)),
        response.getResponse().getContentAsString());
  }

  // ---- POST /post ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_add_a_funding_source_and_both_values_are_trimmed() throws Exception {
    when(fundingSourceRepository.existsById("sub0")).thenReturn(false);
    when(fundingSourceRepository.save(sub0())).thenReturn(sub0());

    MvcResult response =
        mockMvc
            .perform(
                post(POST)
                    .param("abbreviation", "  sub0 ")
                    .param("explanation", " Temporary Sub Zero  ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).existsById("sub0");
    verify(fundingSourceRepository, times(1)).save(sub0());
    assertEquals(mapper.writeValueAsString(sub0()), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_abbreviation_is_stored_as_typed_and_may_be_exactly_ten_characters()
      throws Exception {
    FundingSource ten =
        FundingSource.builder().abbreviation("abcdefghij").explanation("Ten").build();
    when(fundingSourceRepository.existsById("abcdefghij")).thenReturn(false);
    when(fundingSourceRepository.save(ten)).thenReturn(ten);

    MvcResult response =
        mockMvc
            .perform(
                post(POST)
                    .param("abbreviation", "abcdefghij")
                    .param("explanation", "Ten")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).save(ten);
    assertEquals(mapper.writeValueAsString(ten), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_blank_abbreviation_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(post(POST).param("abbreviation", "   ").param("explanation", "x").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("IllegalArgumentException", json.get("type"));
    assertEquals("An abbreviation is required", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_abbreviation_of_eleven_characters_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                post(POST)
                    .param("abbreviation", " abcdefghijk ")
                    .param("explanation", "x")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals(
        "An abbreviation is at most 10 characters (abcdefghijk has 11)", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_blank_explanation_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                post(POST).param("abbreviation", "sub0").param("explanation", " ").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("An explanation is required", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_abbreviation_that_already_exists_is_a_400() throws Exception {
    when(fundingSourceRepository.existsById("sub0")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(
                post(POST).param("abbreviation", "sub0").param("explanation", "Again").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("Funding source sub0 already exists", json.get("message"));
  }

  // ---- PUT /put ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_change_the_explanation_which_is_trimmed() throws Exception {
    FundingSource changed =
        FundingSource.builder()
            .abbreviation("sub0")
            .explanation("Temporary Sub Zero funds")
            .build();
    when(fundingSourceRepository.findById("sub0")).thenReturn(Optional.of(sub0()));
    when(fundingSourceRepository.save(changed)).thenReturn(changed);

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=sub0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(explanationBody("  Temporary Sub Zero funds "))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).findById("sub0");
    verify(fundingSourceRepository, times(1)).save(changed);
    assertEquals(mapper.writeValueAsString(changed), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void putting_an_unknown_abbreviation_is_a_404() throws Exception {
    when(fundingSourceRepository.findById("startup")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=startup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(explanationBody("Startup funds"))
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id startup not found", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void putting_a_blank_explanation_is_a_400() throws Exception {
    when(fundingSourceRepository.findById("sub0")).thenReturn(Optional.of(sub0()));

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=sub0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(explanationBody("   "))
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("An explanation is required", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void putting_a_body_without_an_explanation_is_a_400() throws Exception {
    when(fundingSourceRepository.findById("sub0")).thenReturn(Optional.of(sub0()));

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=sub0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("An explanation is required", json.get("message"));
  }

  // ---- DELETE /delete ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_delete_a_funding_source_no_hiring_record_carries() throws Exception {
    when(fundingSourceRepository.findById("sub0")).thenReturn(Optional.of(sub0()));
    when(hiringRecordRepository.countByFundingSource("sub0")).thenReturn(0L);

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=sub0").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).findById("sub0");
    verify(hiringRecordRepository, times(1)).countByFundingSource("sub0");
    verify(fundingSourceRepository, times(1)).delete(sub0());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id sub0 deleted", json.get("message"));
  }

  /** Issue #512, part 2: a source that hiring records (issue #509) carry stays, with a 400. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_a_funding_source_in_use_is_refused_with_the_count() throws Exception {
    when(fundingSourceRepository.findById("sub0")).thenReturn(Optional.of(sub0()));
    when(hiringRecordRepository.countByFundingSource("sub0")).thenReturn(3L);

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=sub0").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("IllegalArgumentException", json.get("type"));
    assertEquals(
        "Funding source sub0 is used by 3 hiring record(s) and cannot be deleted.",
        json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_single_hiring_record_is_enough_to_refuse_the_delete() throws Exception {
    when(fundingSourceRepository.findById("ds-gift")).thenReturn(Optional.of(dsGift()));
    when(hiringRecordRepository.countByFundingSource("ds-gift")).thenReturn(1L);

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=ds-gift").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals(
        "Funding source ds-gift is used by 1 hiring record(s) and cannot be deleted.",
        json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_an_unknown_abbreviation_is_a_404() throws Exception {
    when(fundingSourceRepository.findById("startup")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=startup").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(fundingSourceRepository, never()).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id startup not found", json.get("message"));
  }
}
