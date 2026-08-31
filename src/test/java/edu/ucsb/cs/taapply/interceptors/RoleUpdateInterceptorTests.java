package edu.ucsb.cs.taapply.interceptors;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.config.SecurityConfig;
import edu.ucsb.cs.taapply.controller.DummyController;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.services.RoleAssignmentService;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({RoleUpdateInterceptor.class, DummyController.class})
@Import({TestConfig.class, SecurityConfig.class, RoleAssignmentService.class})
public class RoleUpdateInterceptorTests {

  @MockitoBean AdminRepository adminRepository;
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean GradStudentRepository gradStudentRepository;

  @Autowired MockMvc mockMvc;

  @Test
  public void a_regular_ucsb_user_is_a_user_and_an_undergrad() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "UNDERGRAD"));
  }

  @Test
  public void admin_in_db_gets_admin_role() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "ADMIN"));
  }

  @Test
  public void instructor_in_db_gets_instructor_role() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "INSTRUCTOR"));
  }

  @Test
  public void admin_role_removed_when_user_loses_admin_status() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(
                            new SimpleGrantedAuthority("ROLE_USER"),
                            new SimpleGrantedAuthority("ROLE_ADMIN"))))
        .andExpect(authenticated().withRoles("USER", "UNDERGRAD"));
  }

  @Test
  public void instructor_role_removed_when_user_loses_instructor_status() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(
                            new SimpleGrantedAuthority("ROLE_USER"),
                            new SimpleGrantedAuthority("ROLE_INSTRUCTOR"))))
        .andExpect(authenticated().withRoles("USER", "UNDERGRAD"));
  }

  @Test
  public void custom_authorities_preserved_when_promoting_to_admin() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(
                            new SimpleGrantedAuthority("ROLE_USER"),
                            new SimpleGrantedAuthority("ROLE_CUSTOM"))))
        .andExpect(authenticated().withRoles("USER", "ADMIN", "CUSTOM"))
        .andExpect(status().isOk())
        .andExpect(content().string("OK"));
  }

  @Test
  @WithMockUser
  public void non_oauth_authentication_passes_through_unchanged() throws Exception {
    mockMvc
        .perform(get("/dummycontroller/interceptorTest"))
        .andExpect(authenticated().withRoles("USER"));
  }

  @Test
  public void oauth2_non_oidc_authentication_passes_through_unchanged() throws Exception {
    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(oauth2Login().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER"));
  }

  @Test
  public void grad_student_in_db_gets_grad_student_role() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "GRAD_STUDENT"));
  }

  @Test
  public void grad_student_role_removed_when_user_loses_grad_student_status() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(
                            new SimpleGrantedAuthority("ROLE_USER"),
                            new SimpleGrantedAuthority("ROLE_GRAD_STUDENT"))))
        .andExpect(authenticated().withRoles("USER", "UNDERGRAD"));
  }

  /** The roles are independent, so a user may hold all three at once. */
  @Test
  public void user_can_hold_admin_instructor_and_grad_student_simultaneously() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);
    when(gradStudentRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "ADMIN", "INSTRUCTOR", "GRAD_STUDENT"));
  }

  /**
   * An email listed in the app.admin.emails property is an admin even when the admins table has no
   * row for it, so the bootstrap admin works against a fresh database.
   */
  @Test
  public void email_in_admin_emails_property_gets_admin_role() throws Exception {
    when(adminRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("phtcon@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("phtcon@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER", "ADMIN"));
  }

  /** UNDERGRAD is for UCSB addresses only, so an outside address gets just ROLE_USER. */
  @Test
  public void a_non_ucsb_user_does_not_get_the_undergrad_role() throws Exception {
    when(adminRepository.existsByEmail("someone@gmail.com")).thenReturn(false);
    when(instructorRepository.existsByEmail("someone@gmail.com")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("someone@gmail.com")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("someone@gmail.com"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER"));
  }

  /** Being made a grad student takes the undergrad role away on the very next request. */
  @Test
  public void undergrad_role_is_dropped_when_the_user_becomes_a_grad_student() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(gradStudentRepository.existsByEmail("user@ucsb.edu")).thenReturn(true);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(
                            new SimpleGrantedAuthority("ROLE_USER"),
                            new SimpleGrantedAuthority("ROLE_UNDERGRAD"))))
        .andExpect(authenticated().withRoles("USER", "GRAD_STUDENT"));
  }
}
