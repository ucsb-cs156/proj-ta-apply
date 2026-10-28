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
import edu.ucsb.cs.taapply.controller.AppSettingsController.NameItem;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AppSettingsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class AppSettingsControllerTests extends ControllerTestCase {

  @MockitoBean TaMajorRepository taMajorRepository;
  @MockitoBean TaTopicRepository taTopicRepository;
  @MockitoBean UlaMajorRepository ulaMajorRepository;
  @MockitoBean UlaTopicRepository ulaTopicRepository;

  private static final String LISTS = "ta-majors,ta-topics,ula-majors,ula-topics";

  // ---- authorization ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/admin/settings/ta-majors/all")).andExpect(status().is(403));
    mockMvc
        .perform(post("/api/admin/settings/ta-majors/post?name=CS").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/admin/settings/ta-majors?name=CS&newName=CE").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(delete("/api/admin/settings/ta-majors/delete?name=CS").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR", "GRAD_STUDENT", "UNDERGRAD"})
  @Test
  public void non_admins_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/admin/settings/ta-majors/all")).andExpect(status().is(403));
    mockMvc
        .perform(post("/api/admin/settings/ta-majors/post?name=CS").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/admin/settings/ta-majors?name=CS&newName=CE").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(delete("/api/admin/settings/ta-majors/delete?name=CS").with(csrf()))
        .andExpect(status().is(403));
    verify(taMajorRepository, never()).save(any());
    verify(taMajorRepository, never()).deleteById(any());
  }

  // ---- the list segment ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_list_is_a_400_naming_the_valid_ones() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/settings/ta-minors/all"))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "No such settings list: ta-minors (expected one of [ta-majors, ta-topics, ula-majors,"
            + " ula-topics])",
        responseToJson(response).get("message"));
  }

  /** Each segment reaches its own table, and only that table. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void each_list_is_backed_by_its_own_repository() throws Exception {
    when(taMajorRepository.findAll()).thenReturn(List.of(TaMajor.builder().name("CS").build()));
    when(taTopicRepository.findAll())
        .thenReturn(List.of(TaTopic.builder().name("Compilers").build()));
    when(ulaMajorRepository.findAll())
        .thenReturn(List.of(UlaMajor.builder().name("Stats").build()));
    when(ulaTopicRepository.findAll())
        .thenReturn(List.of(UlaTopic.builder().name("Python").build()));

    assertEquals(
        mapper.writeValueAsString(List.of(new NameItem("CS"))),
        body(get("/api/admin/settings/ta-majors/all")));
    assertEquals(
        mapper.writeValueAsString(List.of(new NameItem("Compilers"))),
        body(get("/api/admin/settings/ta-topics/all")));
    assertEquals(
        mapper.writeValueAsString(List.of(new NameItem("Stats"))),
        body(get("/api/admin/settings/ula-majors/all")));
    assertEquals(
        mapper.writeValueAsString(List.of(new NameItem("Python"))),
        body(get("/api/admin/settings/ula-topics/all")));
  }

  private String body(org.springframework.test.web.servlet.RequestBuilder request)
      throws Exception {
    return mockMvc
        .perform(request)
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  // ---- GET all ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void all_is_sorted_case_insensitively() throws Exception {
    when(taMajorRepository.findAll())
        .thenReturn(
            List.of(
                TaMajor.builder().name("Statistics").build(),
                TaMajor.builder().name("computer engineering").build(),
                TaMajor.builder().name("Computer Science").build()));

    List<NameItem> expected =
        List.of(
            new NameItem("computer engineering"),
            new NameItem("Computer Science"),
            new NameItem("Statistics"));
    assertEquals(
        mapper.writeValueAsString(expected), body(get("/api/admin/settings/ta-majors/all")));
  }

  // ---- POST ----

  @WithMockUser(roles = {"ADMIN"})
  @ParameterizedTest
  @ValueSource(strings = {"ta-majors", "ta-topics", "ula-majors", "ula-topics"})
  public void an_admin_can_add_a_name_to_each_list(String list) throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                post("/api/admin/settings/" + list + "/post?name=  Computer Science ").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    // Trimmed, since the name is the key.
    assertEquals(
        mapper.writeValueAsString(new NameItem("Computer Science")),
        response.getResponse().getContentAsString());
    switch (list) {
      case "ta-majors" ->
          verify(taMajorRepository, times(1))
              .save(TaMajor.builder().name("Computer Science").build());
      case "ta-topics" ->
          verify(taTopicRepository, times(1))
              .save(TaTopic.builder().name("Computer Science").build());
      case "ula-majors" ->
          verify(ulaMajorRepository, times(1))
              .save(UlaMajor.builder().name("Computer Science").build());
      default ->
          verify(ulaTopicRepository, times(1))
              .save(UlaTopic.builder().name("Computer Science").build());
    }
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void adding_a_blank_name_is_refused() throws Exception {
    MvcResult response =
        mockMvc
            .perform(post("/api/admin/settings/ta-topics/post?name=   ").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals("A name is required", responseToJson(response).get("message"));
    verify(taTopicRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void adding_a_duplicate_is_refused() throws Exception {
    when(ulaMajorRepository.existsById("Statistics")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/settings/ula-majors/post?name=Statistics").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals("Statistics is already in the list", responseToJson(response).get("message"));
    verify(ulaMajorRepository, never()).save(any());
  }

  // ---- PUT (rename) ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void renaming_replaces_the_old_row_with_the_new_one() throws Exception {
    when(taMajorRepository.existsById("Comp Sci")).thenReturn(true);
    when(taMajorRepository.existsById("Computer Science")).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/settings/ta-majors?name=Comp Sci&newName= Computer Science ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(new NameItem("Computer Science")),
        response.getResponse().getContentAsString());
    verify(taMajorRepository, times(1)).deleteById("Comp Sci");
    verify(taMajorRepository, times(1)).save(TaMajor.builder().name("Computer Science").build());
  }

  /** Saving an edit without changing anything should not delete and re-insert the row. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void renaming_to_the_same_name_changes_nothing() throws Exception {
    when(ulaTopicRepository.existsById("Python")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/settings/ula-topics?name=Python&newName=Python").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(new NameItem("Python")),
        response.getResponse().getContentAsString());
    verify(ulaTopicRepository, never()).deleteById(any());
    verify(ulaTopicRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void renaming_a_name_that_is_not_in_the_list_is_a_404() throws Exception {
    when(taTopicRepository.existsById("Nope")).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/settings/ta-topics?name=Nope&newName=Yes").with(csrf()))
            .andExpect(status().is(404))
            .andReturn();
    assertEquals("NameItem with id Nope not found", responseToJson(response).get("message"));
    verify(taTopicRepository, never()).deleteById(any());
    verify(taTopicRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void renaming_onto_an_existing_name_is_refused() throws Exception {
    when(taTopicRepository.existsById("Java")).thenReturn(true);
    when(taTopicRepository.existsById("Python")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/settings/ta-topics?name=Java&newName=Python").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals("Python is already in the list", responseToJson(response).get("message"));
    verify(taTopicRepository, never()).deleteById(any());
    verify(taTopicRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void renaming_to_a_blank_name_is_refused() throws Exception {
    when(taTopicRepository.existsById("Java")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/settings/ta-topics?name=Java&newName= ").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals("A name is required", responseToJson(response).get("message"));
    verify(taTopicRepository, never()).deleteById(any());
  }

  // ---- DELETE ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_remove_a_name() throws Exception {
    when(ulaMajorRepository.existsById("Statistics")).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/settings/ula-majors/delete?name=Statistics").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("Statistics removed from ula-majors", responseToJson(response).get("message"));
    verify(ulaMajorRepository, times(1)).deleteById("Statistics");
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void removing_a_name_that_is_not_in_the_list_is_a_404() throws Exception {
    when(ulaMajorRepository.existsById("Nope")).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/settings/ula-majors/delete?name=Nope").with(csrf()))
            .andExpect(status().is(404))
            .andReturn();
    assertEquals("NameItem with id Nope not found", responseToJson(response).get("message"));
    verify(ulaMajorRepository, never()).deleteById(any());
  }

  /** Keeps the constant list in the controller honest about which segments exist. */
  @Test
  public void the_list_constants_match_the_url_segments() {
    assertEquals(
        LISTS,
        String.join(
            ",",
            AppSettingsController.TA_MAJORS,
            AppSettingsController.TA_TOPICS,
            AppSettingsController.ULA_MAJORS,
            AppSettingsController.ULA_TOPICS));
  }
}
