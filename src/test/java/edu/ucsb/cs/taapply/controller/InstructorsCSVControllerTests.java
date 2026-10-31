package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
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
  @MockitoBean CatalogNameRepository catalogNameRepository;

  private static final String URL = "/api/admin/instructors/upload/csv";
  private static final String DOWNLOAD_URL = "/api/admin/instructors/download/csv";

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

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
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

  // ---- catalog names in the upload (issue #172) ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_catalog_name_on_record_is_set_on_a_new_instructor() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);

    mockMvc
        .perform(
            multipart(URL)
                .file(csv("email, CatalogName \na@ucsb.edu,GAUCHO C\nb@ucsb.edu,\n"))
                .with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(2)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getAllValues().get(0).getEmail());
    assertEquals("GAUCHO C", captor.getAllValues().get(0).getCatalogName());
    assertEquals("b@ucsb.edu", captor.getAllValues().get(1).getEmail());
    assertEquals(null, captor.getAllValues().get(1).getCatalogName());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_catalog_name_not_on_record_is_left_unset() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);
    when(catalogNameRepository.existsById(any())).thenReturn(false);

    mockMvc
        .perform(multipart(URL).file(csv("email,catalogName\na@ucsb.edu,NOBODY X\n")).with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
    assertEquals(null, captor.getValue().getCatalogName());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_catalog_name_updates_an_instructor_already_on_the_list() throws Exception {
    when(instructorRepository.existsByEmail("a@ucsb.edu")).thenReturn(true);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);
    Instructor existing = Instructor.builder().email("a@ucsb.edu").build();
    when(instructorRepository.findById("a@ucsb.edu")).thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(
                multipart(URL).file(csv("email,catalogName\na@ucsb.edu,GAUCHO C\n")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
    assertEquals("GAUCHO C", captor.getValue().getCatalogName());
    assertEquals(
        mapper.writeValueAsString(
            new RoleEmailCsvService.UploadResult(0, 1, 0, java.util.List.of())),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_blank_or_absent_catalog_name_leaves_an_existing_instructor_alone()
      throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(true);

    mockMvc
        .perform(
            multipart(URL).file(csv("email,catalogName\na@ucsb.edu,\nb@ucsb.edu\n")).with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(multipart(URL).file(csv("email\na@ucsb.edu\n")).with(csrf()))
        .andExpect(status().isOk());

    verify(catalogNameRepository, never()).existsById(any());
    verify(instructorRepository, never()).findById(any());
    verify(instructorRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_instructor_deleted_mid_upload_is_not_resaved() throws Exception {
    when(instructorRepository.existsByEmail("a@ucsb.edu")).thenReturn(true);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);
    when(instructorRepository.findById("a@ucsb.edu")).thenReturn(Optional.empty());

    mockMvc
        .perform(multipart(URL).file(csv("email,catalogName\na@ucsb.edu,GAUCHO C\n")).with(csrf()))
        .andExpect(status().isOk());

    verify(instructorRepository, never()).save(any());
  }

  /** Kills the boundary mutant on `extraColumn < 0`: column index 0 is a real column. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_catalog_name_column_can_come_before_the_email_column() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);

    mockMvc
        .perform(multipart(URL).file(csv("catalogName,email\nGAUCHO C,a@ucsb.edu\n")).with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
    assertEquals("GAUCHO C", captor.getValue().getCatalogName());
  }

  // ---- CSV download (issue #172) ----

  @Test
  public void logged_out_users_cannot_download() throws Exception {
    mockMvc.perform(get(DOWNLOAD_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_download() throws Exception {
    mockMvc.perform(get(DOWNLOAD_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void instructors_cannot_download() throws Exception {
    mockMvc.perform(get(DOWNLOAD_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_download_has_names_from_the_users_table_and_the_catalog_name()
      throws Exception {
    Instructor withEverything =
        Instructor.builder().email("a@ucsb.edu").catalogName("GAUCHO C").build();
    Instructor neverLoggedIn = Instructor.builder().email("b@ucsb.edu").build();
    when(instructorRepository.findAll())
        .thenReturn(java.util.List.of(withEverything, neverLoggedIn));
    when(userRepository.findByEmail("a@ucsb.edu"))
        .thenReturn(
            Optional.of(
                User.builder()
                    .email("a@ucsb.edu")
                    .givenName("Chris")
                    .familyName("Gaucho")
                    .build()));
    when(userRepository.findByEmail("b@ucsb.edu")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get(DOWNLOAD_URL))
            .andExpect(status().isOk())
            .andExpect(
                header().string("Content-Disposition", "attachment; filename=\"instructors.csv\""))
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn();

    assertEquals(
        "\"email\",\"firstName\",\"lastName\",\"catalogName\"\n"
            + "\"a@ucsb.edu\",\"Chris\",\"Gaucho\",\"GAUCHO C\"\n"
            + "\"b@ucsb.edu\",\"\",\"\",\"\"\n",
        response.getResponse().getContentAsString());
  }

  /** A user row created before the name columns were leaves the name cells blank, not null. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_download_leaves_blank_names_for_a_user_without_them() throws Exception {
    when(instructorRepository.findAll())
        .thenReturn(java.util.List.of(Instructor.builder().email("a@ucsb.edu").build()));
    when(userRepository.findByEmail("a@ucsb.edu"))
        .thenReturn(Optional.of(User.builder().email("a@ucsb.edu").build()));

    MvcResult response = mockMvc.perform(get(DOWNLOAD_URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        "\"email\",\"firstName\",\"lastName\",\"catalogName\"\n"
            + "\"a@ucsb.edu\",\"\",\"\",\"\"\n",
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_empty_instructor_list_downloads_as_just_the_header() throws Exception {
    when(instructorRepository.findAll()).thenReturn(java.util.List.of());

    MvcResult response = mockMvc.perform(get(DOWNLOAD_URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        "\"email\",\"firstName\",\"lastName\",\"catalogName\"\n",
        response.getResponse().getContentAsString());
  }

  /** The downloaded shape round-trips: the upload reads the email and catalogName columns. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_download_format_is_accepted_by_the_upload() throws Exception {
    when(instructorRepository.existsByEmail(any())).thenReturn(false);
    when(catalogNameRepository.existsById("GAUCHO C")).thenReturn(true);

    mockMvc
        .perform(
            multipart(URL)
                .file(
                    csv(
                        "\"email\",\"firstName\",\"lastName\",\"catalogName\"\n"
                            + "\"a@ucsb.edu\",\"Chris\",\"Gaucho\",\"GAUCHO C\"\n"))
                .with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Instructor> captor = ArgumentCaptor.forClass(Instructor.class);
    verify(instructorRepository, times(1)).save(captor.capture());
    assertEquals("a@ucsb.edu", captor.getValue().getEmail());
    assertEquals("GAUCHO C", captor.getValue().getCatalogName());
  }
}
