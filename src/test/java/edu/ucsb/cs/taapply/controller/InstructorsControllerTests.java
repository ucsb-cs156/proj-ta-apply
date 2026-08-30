package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.ArrayList;
import java.util.Arrays;
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
    Instructor instructor = Instructor.builder().email("ins@ucsb.edu").build();
    ArrayList<Instructor> expectedInstructors = new ArrayList<>(Arrays.asList(instructor));
    when(instructorRepository.findAll()).thenReturn(new ArrayList<>(Arrays.asList(instructor)));

    MvcResult response =
        mockMvc.perform(get("/api/admin/instructors/get")).andExpect(status().isOk()).andReturn();

    verify(instructorRepository, times(1)).findAll();
    String expectedJson = mapper.writeValueAsString(expectedInstructors);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
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
