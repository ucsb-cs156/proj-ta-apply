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
import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
@TestPropertySource(
    properties = "app.admin.emails=djensen@ucsb.edu,phtcon@ucsb.edu,acdamstedt@ucsb.edu")
public class AdminsControllerTests extends ControllerTestCase {

  @MockitoBean AdminRepository adminRepository;
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean GradStudentRepository gradStudentRepository;
  @MockitoBean UserRepository userRepository;

  // Authorization tests for post

  @Test
  public void logged_out_users_cannot_post() throws Exception {
    mockMvc.perform(post("/api/admin/post?email=test@ucsb.edu")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_post() throws Exception {
    mockMvc.perform(post("/api/admin/post?email=test@ucsb.edu")).andExpect(status().is(403));
  }

  // Authorization tests for get all

  @Test
  public void logged_out_users_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/admin/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/admin/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admin_can_get_all() throws Exception {
    mockMvc.perform(get("/api/admin/all")).andExpect(status().is(200));
  }

  @Test
  public void logged_out_users_cannot_get_paged_users() throws Exception {
    mockMvc.perform(get("/api/admin/users")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_users_cannot_get_paged_users() throws Exception {
    mockMvc.perform(get("/api/admin/users")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admin_can_get_paged_users() throws Exception {
    when(userRepository.findAll(any(PageRequest.class)))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10, Sort.by("id")), 0));
    mockMvc.perform(get("/api/admin/users")).andExpect(status().is(200));
  }

  // Authorization tests for delete

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/delete?email=someone@gmail.com"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/delete?email=someone@gmail.com"))
        .andExpect(status().is(403));
  }

  // Functionality tests

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_user_can_post_a_new_admin() throws Exception {
    Admin admin = Admin.builder().email("newadmin@ucsb.edu").build();
    when(adminRepository.save(eq(admin))).thenReturn(admin);

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/post?email=newadmin@ucsb.edu").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(adminRepository, times(1)).save(admin);
    String expectedJson = mapper.writeValueAsString(admin);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_user_can_post_a_new_admin_and_email_is_sanitized() throws Exception {
    Admin admin = Admin.builder().email("newadmin@ucsb.edu").build();
    when(adminRepository.save(eq(admin))).thenReturn(admin);

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/post?email= newadmin@ucsb.edu ").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(adminRepository, times(1)).save(admin);
    String expectedJson = mapper.writeValueAsString(admin);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admin_can_get_all_admins() throws Exception {
    List<String> adminEmailList = Arrays.asList("acdamstedt@ucsb.edu");

    Admin admin1 = Admin.builder().email("acdamstedt@ucsb.edu").build();
    AdminsController.AdminDTO adminDTO1 = new AdminsController.AdminDTO(admin1, adminEmailList);

    Admin admin2 = Admin.builder().email("other@ucsb.edu").build();
    AdminsController.AdminDTO adminDTO2 = new AdminsController.AdminDTO(admin2, adminEmailList);

    ArrayList<Admin> expectedAdmins = new ArrayList<>(Arrays.asList(admin1, admin2));
    ArrayList<AdminsController.AdminDTO> expectedAdminDTOs =
        new ArrayList<>(Arrays.asList(adminDTO1, adminDTO2));

    when(adminRepository.findAll()).thenReturn(expectedAdmins);

    MvcResult response =
        mockMvc.perform(get("/api/admin/all")).andExpect(status().isOk()).andReturn();

    verify(adminRepository, times(1)).findAll();
    String expectedJson = mapper.writeValueAsString(expectedAdminDTOs);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void logged_in_admin_can_get_paged_users_with_roles() throws Exception {
    User user1 =
        User.builder()
            .id(1L)
            .givenName("Phill")
            .familyName("Conrad")
            .email("phtcon@ucsb.edu")
            .build();
    User user2 =
        User.builder()
            .id(2L)
            .givenName("Craig")
            .familyName("Zzyxx")
            .email("craig.zzyzx@example.org")
            .build();

    PageRequest pageRequest = PageRequest.of(0, 10, Sort.by("id"));
    Page<User> usersPage = new PageImpl<>(List.of(user1, user2), pageRequest, 2);
    // user1 is both an admin and a grad student: the roles are independent, so a user may hold
    // any combination of them.
    List<AdminsController.UserDTO> expectedUsers =
        List.of(
            new AdminsController.UserDTO(user1, true, false, true),
            new AdminsController.UserDTO(user2, false, true, false));
    AdminsController.UsersPageDTO expectedPage =
        new AdminsController.UsersPageDTO(expectedUsers, 0, 10, 2, 1);

    when(userRepository.findAll(eq(pageRequest))).thenReturn(usersPage);
    when(adminRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(true);
    when(adminRepository.existsByEmail("craig.zzyzx@example.org")).thenReturn(false);
    when(instructorRepository.existsByEmail("craig.zzyzx@example.org")).thenReturn(true);
    when(gradStudentRepository.existsByEmail("craig.zzyzx@example.org")).thenReturn(false);

    MvcResult response =
        mockMvc.perform(get("/api/admin/users")).andExpect(status().isOk()).andReturn();

    verify(userRepository, times(1)).findAll(pageRequest);
    verify(adminRepository, times(1)).existsByEmail("phtcon@ucsb.edu");
    verify(instructorRepository, times(1)).existsByEmail("phtcon@ucsb.edu");
    verify(gradStudentRepository, times(1)).existsByEmail("phtcon@ucsb.edu");
    verify(adminRepository, times(1)).existsByEmail("craig.zzyzx@example.org");
    verify(instructorRepository, times(1)).existsByEmail("craig.zzyzx@example.org");
    verify(gradStudentRepository, times(1)).existsByEmail("craig.zzyzx@example.org");
    String expectedJson = mapper.writeValueAsString(expectedPage);
    String responseString = response.getResponse().getContentAsString();
    assertEquals(expectedJson, responseString);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_delete_an_admin() throws Exception {
    Admin admin = Admin.builder().email("someone@gmail.com").build();
    when(adminRepository.findByEmail("someone@gmail.com")).thenReturn(Optional.of(admin));

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/delete?email=someone@gmail.com").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(adminRepository, times(1)).findByEmail("someone@gmail.com");
    verify(adminRepository, times(1)).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("Admin with id someone@gmail.com deleted", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_tries_to_delete_non_existant_admin_and_gets_right_error_message()
      throws Exception {
    when(adminRepository.findByEmail("nobody@gmail.com")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/delete?email=nobody@gmail.com").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(adminRepository, times(1)).findByEmail("nobody@gmail.com");
    Map<String, Object> json = responseToJson(response);
    assertEquals("Admin with id nobody@gmail.com not found", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_tries_to_delete_an_ADMIN_EMAIL_and_gets_right_error_message() throws Exception {
    Admin admin = Admin.builder().email("acdamstedt@ucsb.edu").build();
    when(adminRepository.findByEmail("acdamstedt@ucsb.edu")).thenReturn(Optional.of(admin));

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/delete?email=acdamstedt@ucsb.edu").with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    verify(adminRepository, times(1)).findByEmail("acdamstedt@ucsb.edu");
    Map<String, Object> json = responseToJson(response);
    assertEquals("Forbidden to delete an admin from ADMIN_EMAILS list", json.get("message"));
  }
}
