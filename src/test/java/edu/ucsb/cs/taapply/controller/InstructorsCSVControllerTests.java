package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.InstructorsCSVController.class)
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, RoleEmailCsvService.class})
public class InstructorsCSVControllerTests extends ControllerTestCase {

  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean UserRepository userRepository;

  private static final String URL = "/api/admin/instructors/upload/csv";

  private MockMultipartFile csv(String content) {
    return new MockMultipartFile(
        "file", "grads.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8));
  }

  @Test
  public void logged_out_users_cannot_upload() throws Exception {
    mockMvc
        .perform(multipart(URL).file(csv("email\na@ucsb.edu\n")).with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_upload() throws Exception {
    mockMvc
        .perform(multipart(URL).file(csv("email\na@ucsb.edu\n")).with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void instructors_cannot_upload() throws Exception {
    mockMvc
        .perform(multipart(URL).file(csv("email\na@ucsb.edu\n")).with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_upload_and_emails_are_inserted() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(multipart(URL).file(csv("email\na@ucsb.edu\nb@ucsb.edu\n")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(2)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getAllValues().get(0).getEmail());
    assertEquals("b@ucsb.edu", captor.getAllValues().get(1).getEmail());

    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(2, 0, 0, java.util.List.of())),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void duplicates_are_counted_not_inserted_again() throws Exception {
    when(instructorRepository.existsByEmail("a@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("b@ucsb.edu")).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(multipart(URL).file(csv("email\na@ucsb.edu\nb@ucsb.edu\n")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(any());
    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(1, 1, 0, java.util.List.of())),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void invalid_rows_are_skipped_and_reported_without_aborting() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                multipart(URL)
                    .file(csv("email\na@ucsb.edu\nnot-an-email\nb@ucsb.edu\n"))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    // The two good rows still saved, even though a bad row sat between them.
    verify(instructorRepository, times(2)).save(any());
    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(2, 0, 1, java.util.List.of("not-an-email"))),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void blank_and_short_rows_are_ignored() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(multipart(URL).file(csv("email\n\na@ucsb.edu\n   \n")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(any());
    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(1, 0, 0, java.util.List.of())),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void email_column_is_found_case_insensitively_and_among_other_columns() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    mockMvc
        .perform(multipart(URL).file(csv("name, EMail ,dept\nAlice,a@ucsb.edu,CS\n")).with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void empty_file_is_a_bad_request() throws Exception {
    mockMvc.perform(multipart(URL).file(csv("")).with(csrf())).andExpect(status().isBadRequest());
    verify(instructorRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void missing_email_header_is_a_bad_request() throws Exception {
    MvcResult response =
        mockMvc
            .perform(multipart(URL).file(csv("name,dept\nAlice,CS\n")).with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(instructorRepository, never()).save(any());
    assertTrue(
        response.getResolvedException().getMessage().contains("must have a column named 'email'"),
        "expected a message naming the required column, got: "
            + response.getResolvedException().getMessage());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void emails_are_canonicalized_before_insert() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    mockMvc
        .perform(multipart(URL).file(csv("email\n  A@UCSB.EDU  \n")).with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void rows_with_fewer_columns_than_the_email_column_are_ignored() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);

    // "email" is the second column, and the "Bob" row stops before reaching it.
    MvcResult response =
        mockMvc
            .perform(multipart(URL).file(csv("name,email\nAlice,a@ucsb.edu\nBob\n")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(instructorRepository, times(1)).save(any());
    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(1, 0, 0, java.util.List.of())),
        response.getResponse().getContentAsString());
  }
}
