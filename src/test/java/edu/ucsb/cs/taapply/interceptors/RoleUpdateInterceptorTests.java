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
@Import({TestConfig.class, SecurityConfig.class})
public class RoleUpdateInterceptorTests {

  @MockitoBean AdminRepository adminRepository;
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean GradStudentRepository gradStudentRepository;

  @Autowired MockMvc mockMvc;

  @Test
  public void regular_user_has_only_user_role() throws Exception {
    when(adminRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);
    when(instructorRepository.existsByEmail("user@ucsb.edu")).thenReturn(false);

    mockMvc
        .perform(
            get("/dummycontroller/interceptorTest")
                .with(
                    oidcLogin()
                        .userInfoToken(t -> t.email("user@ucsb.edu"))
                        .authorities(new SimpleGrantedAuthority("ROLE_USER"))))
        .andExpect(authenticated().withRoles("USER"));
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
        .andExpect(authenticated().withRoles("USER"));
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
        .andExpect(authenticated().withRoles("USER"));
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
}
