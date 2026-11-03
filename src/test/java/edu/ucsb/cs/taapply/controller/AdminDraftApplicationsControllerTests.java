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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminDraftApplicationsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class AdminDraftApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean DraftApplicationRepository draftApplicationRepository;
  @MockitoBean DraftAdminCommentRepository draftAdminCommentRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static DraftApplication draft(long id, long recruitmentId, String email) {
    return DraftApplication.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .email(email)
        .firstName("Ada")
        .lastName("Lovelace")
        .version(3)
        .build();
  }

  // ---- authorization: admins only, since these show other people's unfinished applications ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc
        .perform(get("/api/admin/draftApplications/all?recruitmentId=1"))
        .andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/draftApplications/count?recruitmentId=1"))
        .andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/draftApplications?id=1")).andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/draftApplications/adminComments?id=1&adminComments=x").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void applicants_and_instructors_are_refused_everywhere() throws Exception {
    mockMvc
        .perform(get("/api/admin/draftApplications/all?recruitmentId=1"))
        .andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/draftApplications/count?recruitmentId=1"))
        .andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/draftApplications?id=1")).andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/draftApplications/adminComments?id=1&adminComments=x").with(csrf()))
        .andExpect(status().is(403));
    verify(draftAdminCommentRepository, never()).save(any());
  }

  // ---- the list ----

  /** Each draft is as the applicant's own is, with the admin's comments, if any, added. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_sees_every_draft_of_a_recruitment_with_the_comments_on_each()
      throws Exception {
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(draftApplicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(draft(1L, 7L, "a@ucsb.edu"), draft(2L, 7L, "b@ucsb.edu")));
    when(draftAdminCommentRepository.findByDraftIdIn(List.of(1L, 2L)))
        .thenReturn(List.of(new DraftAdminComment(2L, "Call her")));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode rows = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(2, rows.size());
    assertEquals(1, rows.get(0).get("id").asInt());
    assertEquals("a@ucsb.edu", rows.get(0).get("email").asText());
    assertEquals("Ada", rows.get(0).get("firstName").asText());
    assertEquals(3, rows.get(0).get("version").asInt());
    assertEquals(true, rows.get(0).get("adminComments").isNull());
    assertEquals(2, rows.get(1).get("id").asInt());
    assertEquals("Call her", rows.get(1).get("adminComments").asText());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_recruitment_with_no_drafts_is_an_empty_list() throws Exception {
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(draftApplicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());
    when(draftAdminCommentRepository.findByDraftIdIn(List.of())).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void drafts_of_an_unknown_recruitment_are_a_404() throws Exception {
    when(recruitmentRepository.existsById(99L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications/all?recruitmentId=99"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).findByRecruitmentIdOrderByIdAsc(any());
  }

  // ---- the count ----

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_count_a_recruitment_s_drafts() throws Exception {
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(draftApplicationRepository.countByRecruitmentId(7L)).thenReturn(12L);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications/count?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("12", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void counting_the_drafts_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.existsById(99L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications/count?recruitmentId=99"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).countByRecruitmentId(any());
  }

  // ---- one draft ----

  /** Unlike the applicant's endpoints, this one is not restricted to the caller's own rows. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_read_anyone_s_draft_with_its_comments() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, 7L, "someone@ucsb.edu")));
    when(draftAdminCommentRepository.findById(5L))
        .thenReturn(Optional.of(new DraftAdminComment(5L, "Looks strong")));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications?id=5"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode row = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("someone@ucsb.edu", row.get("email").asText());
    assertEquals("Looks strong", row.get("adminComments").asText());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_draft_nobody_has_commented_on_has_null_comments() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, 7L, "someone@ucsb.edu")));
    when(draftAdminCommentRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications?id=5"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        true,
        mapper.readTree(response.getResponse().getContentAsString()).get("adminComments").isNull());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_missing_draft_is_a_404() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/draftApplications?id=5"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("DraftApplication with id 5 not found", responseToJson(response).get("message"));
  }

  // ---- the admin's comments ----

  /** The draft is not saved, so its version, and the applicant's autosave, are undisturbed. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_save_comments_on_a_draft_without_touching_the_draft() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, 7L, "someone@ucsb.edu")));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/draftApplications/adminComments")
                    .param("id", "5")
                    .param("adminComments", "Interview on Tuesday")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<DraftAdminComment> captor = ArgumentCaptor.forClass(DraftAdminComment.class);
    verify(draftAdminCommentRepository, times(1)).save(captor.capture());
    assertEquals(new DraftAdminComment(5L, "Interview on Tuesday"), captor.getValue());
    verify(draftApplicationRepository, never()).save(any());
    JsonNode row = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("Interview on Tuesday", row.get("adminComments").asText());
    assertEquals(3, row.get("version").asInt());
  }

  /** Clearing the comments is allowed: an empty string is a value, not a missing parameter. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void comments_can_be_cleared() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, 7L, "someone@ucsb.edu")));

    mockMvc
        .perform(
            put("/api/admin/draftApplications/adminComments")
                .param("id", "5")
                .param("adminComments", "")
                .with(csrf()))
        .andExpect(status().isOk());

    verify(draftAdminCommentRepository, times(1)).save(new DraftAdminComment(5L, ""));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void saving_comments_on_a_missing_draft_is_a_404() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/draftApplications/adminComments?id=5&adminComments=x").with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("DraftApplication with id 5 not found", responseToJson(response).get("message"));
    verify(draftAdminCommentRepository, never()).save(any());
  }
}
