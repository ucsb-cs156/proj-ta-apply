package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.HiddenColumn;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.HiddenColumnRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = HiddenColumnsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class HiddenColumnsControllerTests extends ControllerTestCase {

  @MockitoBean HiddenColumnRepository hiddenColumnRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static final String GET_URL =
      "/api/admin/hiddencolumns?tableKey=recruitmentCourses&recruitmentId=7";
  private static final String PUT_URL =
      "/api/admin/hiddencolumns?tableKey=recruitmentCourses&recruitmentId=7&columnId=room";

  private static HiddenColumn hidden(long id, String columnId) {
    return HiddenColumn.builder()
        .id(id)
        .tableKey("recruitmentCourses")
        .recruitmentId(7L)
        .columnId(columnId)
        .build();
  }

  private void recruitmentExists() {
    when(recruitmentRepository.findById(7L))
        .thenReturn(
            Optional.of(
                Recruitment.builder().id(7L).quarter("20264").type(RecruitmentType.TA).build()));
  }

  // ---- GET ----

  @Test
  public void logged_out_users_cannot_read_hidden_columns() throws Exception {
    mockMvc.perform(get(GET_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_hidden_columns() throws Exception {
    mockMvc.perform(get(GET_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_hidden_column_ids_in_order() throws Exception {
    recruitmentExists();
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", 7L))
        .thenReturn(List.of(hidden(1L, "days"), hidden(2L, "room")));

    MvcResult response = mockMvc.perform(get(GET_URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[\"days\",\"room\"]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void reading_the_hidden_columns_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    MvcResult response = mockMvc.perform(get(GET_URL)).andExpect(status().isNotFound()).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 7 not found", json.get("message"));
    verify(hiddenColumnRepository, never())
        .findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(any(), any());
  }

  // ---- PUT ----

  @Test
  public void logged_out_users_cannot_hide_a_column() throws Exception {
    mockMvc.perform(put(PUT_URL + "&hidden=true").with(csrf())).andExpect(status().is(403));
    verify(hiddenColumnRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_hide_a_column() throws Exception {
    mockMvc.perform(put(PUT_URL + "&hidden=true").with(csrf())).andExpect(status().is(403));
    verify(hiddenColumnRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void hiding_a_shown_column_saves_a_row_and_returns_the_list() throws Exception {
    recruitmentExists();
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdAndColumnId(
            "recruitmentCourses", 7L, "room"))
        .thenReturn(Optional.empty());
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", 7L))
        .thenReturn(List.of(hidden(1L, "days"), hidden(2L, "room")));

    MvcResult response =
        mockMvc
            .perform(put(PUT_URL + "&hidden=true").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<HiddenColumn> saved = ArgumentCaptor.forClass(HiddenColumn.class);
    verify(hiddenColumnRepository).save(saved.capture());
    assertEquals("recruitmentCourses", saved.getValue().getTableKey());
    assertEquals(7L, saved.getValue().getRecruitmentId());
    assertEquals("room", saved.getValue().getColumnId());
    verify(hiddenColumnRepository, never()).delete(any());
    assertEquals("[\"days\",\"room\"]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void hiding_a_hidden_column_changes_nothing() throws Exception {
    recruitmentExists();
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdAndColumnId(
            "recruitmentCourses", 7L, "room"))
        .thenReturn(Optional.of(hidden(2L, "room")));
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", 7L))
        .thenReturn(List.of(hidden(2L, "room")));

    MvcResult response =
        mockMvc
            .perform(put(PUT_URL + "&hidden=true").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(hiddenColumnRepository, never()).save(any());
    verify(hiddenColumnRepository, never()).delete(any());
    assertEquals("[\"room\"]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void showing_a_hidden_column_deletes_its_row() throws Exception {
    recruitmentExists();
    HiddenColumn room = hidden(2L, "room");
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdAndColumnId(
            "recruitmentCourses", 7L, "room"))
        .thenReturn(Optional.of(room));
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", 7L))
        .thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(put(PUT_URL + "&hidden=false").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(hiddenColumnRepository).delete(room);
    verify(hiddenColumnRepository, never()).save(any());
    assertEquals("[]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void showing_a_shown_column_changes_nothing() throws Exception {
    recruitmentExists();
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdAndColumnId(
            "recruitmentCourses", 7L, "room"))
        .thenReturn(Optional.empty());
    when(hiddenColumnRepository.findByTableKeyAndRecruitmentIdOrderByColumnIdAsc(
            "recruitmentCourses", 7L))
        .thenReturn(List.of(hidden(1L, "days")));

    MvcResult response =
        mockMvc
            .perform(put(PUT_URL + "&hidden=false").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(hiddenColumnRepository, never()).save(any());
    verify(hiddenColumnRepository, never()).delete(any());
    assertEquals("[\"days\"]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void hiding_a_column_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(put(PUT_URL + "&hidden=true").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 7 not found", responseToJson(response).get("message"));
    verify(hiddenColumnRepository, never()).save(any());
    verify(hiddenColumnRepository, never()).delete(any());
  }
}
