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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.HiringStaff;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.HiringStaffRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = HiringStaffController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class HiringStaffControllerTests extends ControllerTestCase {

  @MockitoBean HiringStaffRepository hiringStaffRepository;
  @MockitoBean UserRepository userRepository;

  // ---- authorization: admins only, and the role itself does not open its own list ----

  @Test
  public void logged_out_users_cannot_post() throws Exception {
    mockMvc
        .perform(post("/api/admin/hiringStaff/post?email=test@ucsb.edu").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "HIRING_STAFF"})
  @Test
  public void hiring_staff_cannot_post() throws Exception {
    mockMvc
        .perform(post("/api/admin/hiringStaff/post?email=test@ucsb.edu").with(csrf()))
        .andExpect(status().is(403));
  }

  @Test
  public void logged_out_users_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/admin/hiringStaff/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR", "HIRING_STAFF"})
  @Test
  public void non_admins_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/admin/hiringStaff/all")).andExpect(status().is(403));
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/hiringStaff/delete?email=someone@gmail.com").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/hiringStaff/delete?email=someone@gmail.com").with(csrf()))
        .andExpect(status().is(403));
    verify(hiringStaffRepository, never()).delete(any());
  }

  // ---- functionality ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_add_hiring_staff_and_the_email_is_canonicalized() throws Exception {
    HiringStaff saved = HiringStaff.builder().email("finance@ucsb.edu").build();
    when(hiringStaffRepository.save(eq(saved))).thenReturn(saved);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/admin/hiringStaff/post?email= Finance@umail.ucsb.edu ").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(hiringStaffRepository, times(1)).save(saved);
    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_the_list_with_names_for_those_who_have_logged_in() throws Exception {
    HiringStaff h1 = HiringStaff.builder().email("finance@ucsb.edu").build();
    HiringStaff h2 = HiringStaff.builder().email("payroll@example.org").build();
    User user1 =
        User.builder().id(3L).email("finance@ucsb.edu").givenName("Fin").familyName("Ance").build();
    when(hiringStaffRepository.findAll()).thenReturn(List.of(h1, h2));
    when(userRepository.findByEmail("finance@ucsb.edu")).thenReturn(Optional.of(user1));
    when(userRepository.findByEmail("payroll@example.org")).thenReturn(Optional.empty());

    List<HiringStaffController.HiringStaffDTO> expected =
        List.of(
            new HiringStaffController.HiringStaffDTO("finance@ucsb.edu", "Fin", "Ance"),
            new HiringStaffController.HiringStaffDTO("payroll@example.org", null, null));
    // The record's own accessors, since the JSON comparison below is built from the same record.
    HiringStaffController.HiringStaffDTO dto2 =
        new HiringStaffController.HiringStaffDTO(h2, Optional.empty());
    assertEquals("payroll@example.org", dto2.email());
    assertNull(dto2.givenName());
    assertNull(dto2.familyName());
    assertEquals(
        expected, List.of(new HiringStaffController.HiringStaffDTO(h1, Optional.of(user1)), dto2));

    MvcResult response =
        mockMvc.perform(get("/api/admin/hiringStaff/all")).andExpect(status().isOk()).andReturn();

    verify(hiringStaffRepository, times(1)).findAll();
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_delete_hiring_staff() throws Exception {
    HiringStaff h = HiringStaff.builder().email("finance@ucsb.edu").build();
    when(hiringStaffRepository.findByEmail("finance@ucsb.edu")).thenReturn(Optional.of(h));

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/hiringStaff/delete?email=finance@ucsb.edu").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(hiringStaffRepository, times(1)).findByEmail("finance@ucsb.edu");
    verify(hiringStaffRepository, times(1)).delete(h);
    Map<String, Object> json = responseToJson(response);
    assertEquals("HiringStaff with id finance@ucsb.edu deleted", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_an_unknown_email_is_a_404() throws Exception {
    when(hiringStaffRepository.findByEmail("nobody@ucsb.edu")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/hiringStaff/delete?email=nobody@ucsb.edu").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(hiringStaffRepository, never()).delete(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("HiringStaff with id nobody@ucsb.edu not found", json.get("message"));
  }
}
