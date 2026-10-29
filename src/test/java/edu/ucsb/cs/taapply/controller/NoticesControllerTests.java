package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = NoticesController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class NoticesControllerTests extends ControllerTestCase {

  @MockitoBean NoticeVersionRepository noticeVersionRepository;
  @MockitoBean UserRepository userRepository;

  private static NoticeVersion version(long id, RecruitmentType type, String content) {
    return NoticeVersion.builder()
        .id(id)
        .type(type)
        .content(content)
        .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4, 5))
        .build();
  }

  private static final NoticeVersion TA_V1 = version(1L, RecruitmentType.TA, "# Terms v1");
  private static final NoticeVersion TA_V2 = version(2L, RecruitmentType.TA, "# Terms v2");

  // ---- authorization ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/notices/current?type=TA")).andExpect(status().is(403));
    mockMvc.perform(get("/api/notices?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/notices/all?type=TA")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/admin/notices?type=TA")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\"}")
                .with(csrf()))
        .andExpect(status().is(403));
  }

  /** Any signed-in user may read: there is no applicant role, so an instructor can too. */
  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void any_signed_in_user_may_read_the_current_notice() throws Exception {
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.TA))
        .thenReturn(Optional.empty());

    mockMvc.perform(get("/api/notices/current?type=TA")).andExpect(status().isOk());
  }

  /** Anyone may read, but the history and the saving are for admins. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void applicants_cannot_see_the_history_or_save() throws Exception {
    mockMvc.perform(get("/api/admin/notices/all?type=TA")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/admin/notices?type=TA")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\"}")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(noticeVersionRepository, never()).save(any());
  }

  // ---- current ----

  @WithMockUser(roles = {"USER"})
  @Test
  public void current_is_the_latest_version_for_the_type_as_a_one_element_list() throws Exception {
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.TA))
        .thenReturn(Optional.of(TA_V2));

    MvcResult response =
        mockMvc.perform(get("/api/notices/current?type=TA")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(TA_V2)), response.getResponse().getContentAsString());
  }

  /** No notice written yet is an empty list, not an error, so the form can show nothing. */
  @WithMockUser(roles = {"USER"})
  @Test
  public void current_is_empty_before_any_notice_is_written() throws Exception {
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.ULA))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/notices/current?type=ULA"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  // ---- by id ----

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_version_can_be_fetched_by_id() throws Exception {
    when(noticeVersionRepository.findById(1L)).thenReturn(Optional.of(TA_V1));

    MvcResult response =
        mockMvc.perform(get("/api/notices?id=1")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(TA_V1), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_missing_version_is_a_404() throws Exception {
    when(noticeVersionRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc.perform(get("/api/notices?id=99")).andExpect(status().is(404)).andReturn();

    assertEquals("NoticeVersion with id 99 not found", responseToJson(response).get("message"));
  }

  // ---- history ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_every_version_newest_first() throws Exception {
    when(noticeVersionRepository.findAllByTypeOrderByIdDesc(RecruitmentType.TA))
        .thenReturn(List.of(TA_V2, TA_V1));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/notices/all?type=TA"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(TA_V2, TA_V1)),
        response.getResponse().getContentAsString());
  }

  // ---- save ----

  /** Each save is a brand new row: no id sent, the type from the request, a fresh timestamp. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void saving_appends_a_new_version_with_a_timestamp() throws Exception {
    when(noticeVersionRepository.save(any()))
        .thenAnswer(
            invocation -> {
              NoticeVersion v = invocation.getArgument(0);
              v.setId(3L);
              return v;
            });
    LocalDateTime before = LocalDateTime.now().minusSeconds(1);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/admin/notices?type=ULA")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"  # Be nice\\n\\nReally.  \"}")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<NoticeVersion> captor = ArgumentCaptor.forClass(NoticeVersion.class);
    verify(noticeVersionRepository, times(1)).save(captor.capture());
    NoticeVersion saved = captor.getValue();
    assertEquals(RecruitmentType.ULA, saved.getType());
    // Trimmed at the ends only; the Markdown inside is kept as written.
    assertEquals("# Be nice\n\nReally.", saved.getContent());
    assertNotNull(saved.getCreatedAt());
    assertTrue(saved.getCreatedAt().isAfter(before));
    assertTrue(saved.getCreatedAt().isBefore(LocalDateTime.now().plusSeconds(1)));

    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
    assertEquals(3, responseToJson(response).get("id"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void saving_blank_text_is_refused() throws Exception {
    for (String body : List.of("{\"content\":\"   \"}", "{\"content\":null}", "{}")) {
      MvcResult response =
          mockMvc
              .perform(
                  post("/api/admin/notices?type=TA")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(body)
                      .with(csrf()))
              .andExpect(status().is(400))
              .andReturn();
      assertEquals("The notice text cannot be blank", responseToJson(response).get("message"));
    }
    verify(noticeVersionRepository, never()).save(any());
  }
}
