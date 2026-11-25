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
import edu.ucsb.cs.taapply.entity.SoftOfferNoticeVersion;
import edu.ucsb.cs.taapply.repository.SoftOfferNoticeVersionRepository;
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

/** Issue #484: the Soft Offer Notices, an append-only history of versions like the notices. */
@WebMvcTest(controllers = SoftOfferNoticesController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class SoftOfferNoticesControllerTests extends ControllerTestCase {

  @MockitoBean SoftOfferNoticeVersionRepository repository;
  @MockitoBean UserRepository userRepository;

  private static SoftOfferNoticeVersion version(long id, String content) {
    return SoftOfferNoticeVersion.builder()
        .id(id)
        .content(content)
        .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4, 5))
        .build();
  }

  private static final SoftOfferNoticeVersion V1 = version(1L, "# Soft offer v1");
  private static final SoftOfferNoticeVersion V2 = version(2L, "# Soft offer v2");

  // ---- authorization ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/softOfferNotices/current")).andExpect(status().is(403));
    mockMvc.perform(get("/api/softOfferNotices?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/softOfferNotices/all")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/admin/softOfferNotices")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\"}")
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void any_signed_in_user_may_read_the_current_notice_and_a_version() throws Exception {
    when(repository.findFirstByOrderByIdDesc()).thenReturn(Optional.of(V2));
    when(repository.findById(1L)).thenReturn(Optional.of(V1));
    mockMvc.perform(get("/api/softOfferNotices/current")).andExpect(status().isOk());
    mockMvc.perform(get("/api/softOfferNotices?id=1")).andExpect(status().isOk());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void applicants_cannot_see_the_history_or_save() throws Exception {
    mockMvc.perform(get("/api/admin/softOfferNotices/all")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/admin/softOfferNotices")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\"}")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(repository, never()).save(any());
  }

  // ---- reading ----

  @WithMockUser(roles = {"USER"})
  @Test
  public void current_is_the_latest_version_as_a_one_element_list() throws Exception {
    when(repository.findFirstByOrderByIdDesc()).thenReturn(Optional.of(V2));

    MvcResult response =
        mockMvc
            .perform(get("/api/softOfferNotices/current"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(V2)), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void current_is_empty_before_any_notice_is_written() throws Exception {
    when(repository.findFirstByOrderByIdDesc()).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/softOfferNotices/current"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_version_can_be_fetched_by_id() throws Exception {
    when(repository.findById(1L)).thenReturn(Optional.of(V1));

    MvcResult response =
        mockMvc.perform(get("/api/softOfferNotices?id=1")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(V1), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_missing_version_is_a_404() throws Exception {
    when(repository.findById(9L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/softOfferNotices?id=9"))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals(
        "SoftOfferNoticeVersion with id 9 not found", responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_every_version_newest_first() throws Exception {
    when(repository.findAllByOrderByIdDesc()).thenReturn(List.of(V2, V1));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/softOfferNotices/all"))
            .andExpect(status().isOk())
            .andReturn();

    verify(repository, times(1)).findAllByOrderByIdDesc();
    assertEquals(
        mapper.writeValueAsString(List.of(V2, V1)), response.getResponse().getContentAsString());
  }

  // ---- saving ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void saving_appends_a_new_version_with_a_timestamp() throws Exception {
    when(repository.save(any()))
        .thenAnswer(
            invocation -> {
              SoftOfferNoticeVersion v = invocation.getArgument(0);
              v.setId(3L);
              return v;
            });
    LocalDateTime before = LocalDateTime.now().minusSeconds(1);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/admin/softOfferNotices")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"  # Congratulations\\n\\nReally.  \"}")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<SoftOfferNoticeVersion> captor =
        ArgumentCaptor.forClass(SoftOfferNoticeVersion.class);
    verify(repository, times(1)).save(captor.capture());
    SoftOfferNoticeVersion saved = captor.getValue();
    // Trimmed at the ends only; the Markdown inside is kept as written.
    assertEquals("# Congratulations\n\nReally.", saved.getContent());
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
                  post("/api/admin/softOfferNotices")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(body)
                      .with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();
      assertEquals("The notice text cannot be blank", responseToJson(response).get("message"));
    }
    verify(repository, never()).save(any());
  }
}
