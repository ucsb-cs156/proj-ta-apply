package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.InstructorsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class InstructorsControllerTests extends ControllerTestCase {

  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean CatalogNameRepository catalogNameRepository;

  // Tests for the POST endpoint

  @Test
  public void logged_out_users_cannot_post() throws Exception {
    mockMvc
        .perform(post("/api/admin/instructors/post?email=test@ucsb.edu"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_post() throws Exception {
    mockMvc
        .perform(post("/api/admin/instructors/post?email=test@ucsb.edu"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admins_can_post() throws Exception {
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    when(instructorRepository.findAll()).thenReturn(new ArrayList<>(Arrays.asList(instructor)));

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/instructors/post?email=ins@ucsb.edu").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(eq(instructor));
    String expectedJson = mapper.writeValueAsString(instructor);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admins_can_post_and_email_is_sanitized() throws Exception {
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    when(instructorRepository.findAll()).thenReturn(new ArrayList<>(Arrays.asList(instructor)));

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/instructors/post?email= ins@ucsb.edu ").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(eq(instructor));
    String expectedJson = mapper.writeValueAsString(instructor);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  // Tests for the GET endpoint

  @Test
  public void logged_out_users_cannot_get() throws Exception {
    mockMvc.perform(get("/api/admin/instructors/get")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_get() throws Exception {
    mockMvc.perform(get("/api/admin/instructors/get")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admins_can_get() throws Exception {
    // ins has logged in, so the users table knows their name; other never has.
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    Instructor other = Instructor.builder().email("other@ucsb.edu").build();
    User user =
        User.builder().id(4L).email("ins@ucsb.edu").givenName("Ina").familyName("Structor").build();
    when(instructorRepository.findAll())
        .thenReturn(new ArrayList<>(Arrays.asList(instructor, other)));
    when(userRepository.findByEmail("ins@ucsb.edu")).thenReturn(Optional.of(user));
    when(userRepository.findByEmail("other@ucsb.edu")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc.perform(get("/api/admin/instructors/get")).andExpect(status().isOk()).andReturn();

    verify(instructorRepository, times(1)).findAll();
    verify(userRepository, times(1)).findByEmail("ins@ucsb.edu");
    verify(userRepository, times(1)).findByEmail("other@ucsb.edu");
    List<InstructorsController.InstructorDTO> expected =
        List.of(
            new InstructorsController.InstructorDTO("ins@ucsb.edu", "Ina", "Structor", null),
            new InstructorsController.InstructorDTO("other@ucsb.edu", null, null, null));
    // The record's own accessors, since the JSON comparison below is built from the same record.
    InstructorsController.InstructorDTO dto1 =
        new InstructorsController.InstructorDTO(instructor, Optional.of(user));
    InstructorsController.InstructorDTO dto2 =
        new InstructorsController.InstructorDTO(other, Optional.empty());
    assertEquals(expected, List.of(dto1, dto2));
    assertEquals("ins@ucsb.edu", dto1.email());
    assertEquals("Ina", dto1.givenName());
    assertEquals("Structor", dto1.familyName());
    assertEquals("other@ucsb.edu", dto2.email());
    assertNull(dto2.givenName());
    assertNull(dto2.familyName());
    String expectedJson = mapper.writeValueAsString(expected);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  // ---- catalog names (issue #120) ----

  @Test
  public void logged_out_users_cannot_list_catalog_names() throws Exception {
    mockMvc.perform(get("/api/admin/instructors/catalogNames")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_list_catalog_names() throws Exception {
    mockMvc.perform(get("/api/admin/instructors/catalogNames")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_get_the_catalog_names_in_order() throws Exception {
    when(catalogNameRepository.findAllByOrderByNameAsc())
        .thenReturn(
            List.of(
                CatalogName.builder().name("CONRAD P").build(),
                CatalogName.builder().name("GAUCHO C").build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/instructors/catalogNames"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[\"CONRAD P\",\"GAUCHO C\"]", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_listing_carries_each_instructors_catalog_name() throws Exception {
    Instructor instructor =
        Instructor.builder().email("ins@ucsb.edu").catalogName("CONRAD P").build();
    when(instructorRepository.findAll()).thenReturn(new ArrayList<>(List.of(instructor)));
    when(userRepository.findByEmail("ins@ucsb.edu")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc.perform(get("/api/admin/instructors/get")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(
            List.of(
                new InstructorsController.InstructorDTO("ins@ucsb.edu", null, null, "CONRAD P"))),
        response.getResponse().getContentAsString());
  }

  @Test
  public void logged_out_users_cannot_set_a_catalog_name() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/instructors/catalogName")
                .param("email", "ins@ucsb.edu")
                .param("catalogName", "CONRAD P")
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_set_an_instructors_catalog_name() throws Exception {
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    when(instructorRepository.findById("ins@ucsb.edu")).thenReturn(Optional.of(instructor));
    when(catalogNameRepository.existsById("CONRAD P")).thenReturn(true);
    User user =
        User.builder().id(4L).email("ins@ucsb.edu").givenName("Ina").familyName("Structor").build();
    when(userRepository.findByEmail("ins@ucsb.edu")).thenReturn(Optional.of(user));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/instructors/catalogName")
                    .param("email", "ins@ucsb.edu")
                    .param("catalogName", " CONRAD P ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(instructor);
    assertEquals("CONRAD P", instructor.getCatalogName());
    assertEquals(
        mapper.writeValueAsString(
            new InstructorsController.InstructorDTO("ins@ucsb.edu", "Ina", "Structor", "CONRAD P")),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_blank_or_missing_catalog_name_clears_the_choice() throws Exception {
    Instructor instructor =
        Instructor.builder().email("ins@ucsb.edu").catalogName("CONRAD P").build();
    when(instructorRepository.findById("ins@ucsb.edu")).thenReturn(Optional.of(instructor));
    when(userRepository.findByEmail("ins@ucsb.edu")).thenReturn(Optional.empty());

    mockMvc
        .perform(
            put("/api/admin/instructors/catalogName")
                .param("email", "ins@ucsb.edu")
                .param("catalogName", "  ")
                .with(csrf()))
        .andExpect(status().isOk());
    assertNull(instructor.getCatalogName());

    instructor.setCatalogName("CONRAD P");
    mockMvc
        .perform(
            put("/api/admin/instructors/catalogName").param("email", "ins@ucsb.edu").with(csrf()))
        .andExpect(status().isOk());
    assertNull(instructor.getCatalogName());
    verify(instructorRepository, times(2)).save(instructor);
    verify(catalogNameRepository, never()).existsById(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_catalog_name_not_on_record_is_refused() throws Exception {
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    when(instructorRepository.findById("ins@ucsb.edu")).thenReturn(Optional.of(instructor));
    when(catalogNameRepository.existsById("NOBODY X")).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/instructors/catalogName")
                    .param("email", "ins@ucsb.edu")
                    .param("catalogName", "NOBODY X")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("CatalogName with id NOBODY X not found", responseToJson(response).get("message"));
    verify(instructorRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void setting_the_catalog_name_of_an_unknown_instructor_is_a_404() throws Exception {
    when(instructorRepository.findById("nobody@ucsb.edu")).thenReturn(Optional.empty());

    mockMvc
        .perform(
            put("/api/admin/instructors/catalogName")
                .param("email", "nobody@ucsb.edu")
                .param("catalogName", "CONRAD P")
                .with(csrf()))
        .andExpect(status().isNotFound());
    verify(instructorRepository, never()).save(any());
  }

  // Tests for the DELETE endpoint

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/instructors/delete").param("email", "test@ucsb.edu"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/instructors/delete").param("email", "test@ucsb.edu"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admins_can_delete() throws Exception {
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    when(instructorRepository.findById(eq("ins@ucsb.edu"))).thenReturn(Optional.of(instructor));

    MvcResult response =
        mockMvc
            .perform(
                delete("/api/admin/instructors/delete").param("email", "ins@ucsb.edu").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).findById("ins@ucsb.edu");
    verify(instructorRepository, times(1)).delete(instructor);
    String expectedMessage =
        String.format("Instructor with email %s deleted.", instructor.getEmail());
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedMessage, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_try_to_delete_a_instructor_not_found() throws Exception {
    String email = "nonexistent@ucsb.edu";
    when(instructorRepository.findById(eq(email))).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/instructors/delete").param("email", email).with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(instructorRepository, times(1)).findById(email);
    verify(instructorRepository, times(0)).delete(any());
    String expectedMessage = String.format("Instructor with email %s not found.", email);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedMessage, responseString);
  }
}
