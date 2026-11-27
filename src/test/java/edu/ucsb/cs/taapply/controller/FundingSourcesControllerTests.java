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

  private static final String ALL = "/api/admin/fundingSources/all";
  private static final String POST = "/api/admin/fundingSources/post";
  private static final String PUT = "/api/admin/fundingSources/put";
  private static final String DELETE = "/api/admin/fundingSources/delete";

  private static FundingSource nsf() {
    return FundingSource.builder()
        .abbreviation("NSF")
        .explanation("National Science Foundation")
        .build();
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
    when(fundingSourceRepository.findAll()).thenReturn(List.of(nsf()));

    MvcResult response = mockMvc.perform(get(ALL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(nsf())), response.getResponse().getContentAsString());
  }

  @Test
  public void logged_out_users_cannot_post() throws Exception {
    mockMvc
        .perform(post(POST + "?abbreviation=NSF&explanation=x").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_post() throws Exception {
    mockMvc
        .perform(post(POST + "?abbreviation=NSF&explanation=x").with(csrf()))
        .andExpect(status().is(403));
    verify(fundingSourceRepository, never()).save(any());
  }

  @Test
  public void logged_out_users_cannot_put() throws Exception {
    mockMvc
        .perform(
            put(PUT + "?abbreviation=NSF")
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
            put(PUT + "?abbreviation=NSF")
                .contentType(MediaType.APPLICATION_JSON)
                .content(explanationBody("x"))
                .with(csrf()))
        .andExpect(status().is(403));
    verify(fundingSourceRepository, never()).save(any());
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc.perform(delete(DELETE + "?abbreviation=NSF").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_delete() throws Exception {
    mockMvc.perform(delete(DELETE + "?abbreviation=NSF").with(csrf())).andExpect(status().is(403));
    verify(fundingSourceRepository, never()).delete(any());
  }

  // ---- GET /all ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_the_list_sorted_by_abbreviation() throws Exception {
    FundingSource ta = FundingSource.builder().abbreviation("TA").explanation("TA funds").build();
    FundingSource dept =
        FundingSource.builder().abbreviation("DEPT").explanation("Department funds").build();
    when(fundingSourceRepository.findAll()).thenReturn(List.of(ta, nsf(), dept));

    MvcResult response = mockMvc.perform(get(ALL)).andExpect(status().isOk()).andReturn();

    verify(fundingSourceRepository, times(1)).findAll();
    assertEquals(
        mapper.writeValueAsString(List.of(dept, nsf(), ta)),
        response.getResponse().getContentAsString());
  }

  // ---- POST /post ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_add_a_funding_source_and_both_values_are_trimmed() throws Exception {
    when(fundingSourceRepository.existsById("NSF")).thenReturn(false);
    when(fundingSourceRepository.save(nsf())).thenReturn(nsf());

    MvcResult response =
        mockMvc
            .perform(
                post(POST)
                    .param("abbreviation", "  NSF ")
                    .param("explanation", " National Science Foundation  ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).existsById("NSF");
    verify(fundingSourceRepository, times(1)).save(nsf());
    assertEquals(mapper.writeValueAsString(nsf()), response.getResponse().getContentAsString());
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
            .perform(post(POST).param("abbreviation", "NSF").param("explanation", " ").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("An explanation is required", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_abbreviation_that_already_exists_is_a_400() throws Exception {
    when(fundingSourceRepository.existsById("NSF")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(
                post(POST).param("abbreviation", "NSF").param("explanation", "Again").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("Funding source NSF already exists", json.get("message"));
  }

  // ---- PUT /put ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_change_the_explanation_which_is_trimmed() throws Exception {
    FundingSource changed =
        FundingSource.builder().abbreviation("NSF").explanation("NSF grant").build();
    when(fundingSourceRepository.findById("NSF")).thenReturn(Optional.of(nsf()));
    when(fundingSourceRepository.save(changed)).thenReturn(changed);

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=NSF")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(explanationBody("  NSF grant "))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).findById("NSF");
    verify(fundingSourceRepository, times(1)).save(changed);
    assertEquals(mapper.writeValueAsString(changed), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void putting_an_unknown_abbreviation_is_a_404() throws Exception {
    when(fundingSourceRepository.findById("NIH")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=NIH")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(explanationBody("National Institutes of Health"))
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(fundingSourceRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id NIH not found", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void putting_a_blank_explanation_is_a_400() throws Exception {
    when(fundingSourceRepository.findById("NSF")).thenReturn(Optional.of(nsf()));

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=NSF")
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
    when(fundingSourceRepository.findById("NSF")).thenReturn(Optional.of(nsf()));

    MvcResult response =
        mockMvc
            .perform(
                put(PUT + "?abbreviation=NSF")
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
  public void an_admin_can_delete_a_funding_source() throws Exception {
    when(fundingSourceRepository.findById("NSF")).thenReturn(Optional.of(nsf()));

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=NSF").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(fundingSourceRepository, times(1)).findById("NSF");
    verify(fundingSourceRepository, times(1)).delete(nsf());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id NSF deleted", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_an_unknown_abbreviation_is_a_404() throws Exception {
    when(fundingSourceRepository.findById("NIH")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(delete(DELETE + "?abbreviation=NIH").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(fundingSourceRepository, never()).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("FundingSource with id NIH not found", json.get("message"));
  }
}
