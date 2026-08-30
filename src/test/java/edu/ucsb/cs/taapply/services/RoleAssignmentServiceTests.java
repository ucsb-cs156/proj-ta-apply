package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = RoleAssignmentService.class)
@ActiveProfiles("test")
@TestPropertySource(properties = "app.admin.emails=bootstrap@ucsb.edu")
public class RoleAssignmentServiceTests {

  @Autowired private RoleAssignmentService service;

  @MockitoBean private AdminRepository adminRepository;
  @MockitoBean private InstructorRepository instructorRepository;
  @MockitoBean private GradStudentRepository gradStudentRepository;

  private Set<String> rolesFor(String email) {
    return service.authoritiesFor(email).stream()
        .map(GrantedAuthority::getAuthority)
        .collect(Collectors.toSet());
  }

  private void noRolesInDb() {
    when(adminRepository.existsByEmail(org.mockito.ArgumentMatchers.any())).thenReturn(false);
    when(instructorRepository.existsByEmail(org.mockito.ArgumentMatchers.any())).thenReturn(false);
    when(gradStudentRepository.existsByEmail(org.mockito.ArgumentMatchers.any())).thenReturn(false);
  }

  // ---- isUcsbEmail ----

  @Test
  public void ucsb_addresses_are_recognized() {
    assertTrue(RoleAssignmentService.isUcsbEmail("cgaucho@ucsb.edu"));
    // Case does not matter: the address is canonicalized first.
    assertTrue(RoleAssignmentService.isUcsbEmail("CGaucho@UCSB.EDU"));
    // CanonicalFormConverter maps umail addresses onto ucsb.edu.
    assertTrue(RoleAssignmentService.isUcsbEmail("cgaucho@umail.ucsb.edu"));
  }

  @Test
  public void non_ucsb_addresses_are_not() {
    assertFalse(RoleAssignmentService.isUcsbEmail("someone@gmail.com"));
    assertFalse(RoleAssignmentService.isUcsbEmail("someone@example.org"));
    // Guards against a naive "contains" check.
    assertFalse(RoleAssignmentService.isUcsbEmail("someone@ucsb.edu.example.com"));
  }

  @Test
  public void a_null_address_is_not_a_ucsb_address() {
    assertFalse(RoleAssignmentService.isUcsbEmail(null));
  }

  // ---- role assignment ----

  @Test
  public void everyone_gets_role_user() {
    noRolesInDb();
    assertTrue(rolesFor("someone@gmail.com").contains("ROLE_USER"));
  }

  @Test
  public void a_ucsb_user_with_no_other_role_is_an_undergrad() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER", "ROLE_UNDERGRAD"), rolesFor("cgaucho@ucsb.edu"));
  }

  /** The role is for UCSB undergrads, so a non-UCSB address does not get it. */
  @Test
  public void a_non_ucsb_user_is_not_an_undergrad() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER"), rolesFor("someone@gmail.com"));
  }

  @Test
  public void an_admin_is_not_an_undergrad() {
    noRolesInDb();
    when(adminRepository.existsByEmail("admin@ucsb.edu")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("admin@ucsb.edu"));
  }

  @Test
  public void an_instructor_is_not_an_undergrad() {
    noRolesInDb();
    when(instructorRepository.existsByEmail("prof@ucsb.edu")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_INSTRUCTOR"), rolesFor("prof@ucsb.edu"));
  }

  @Test
  public void a_grad_student_is_not_an_undergrad() {
    noRolesInDb();
    when(gradStudentRepository.existsByEmail("grad@ucsb.edu")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_GRAD_STUDENT"), rolesFor("grad@ucsb.edu"));
  }

  /** An email in app.admin.emails is an admin even with no row in the admins table. */
  @Test
  public void the_bootstrap_admin_email_gets_admin_and_not_undergrad() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("bootstrap@ucsb.edu"));
  }

  @Test
  public void the_three_main_roles_are_independent() {
    noRolesInDb();
    when(adminRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);
    when(gradStudentRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);

    assertEquals(
        Set.of("ROLE_USER", "ROLE_ADMIN", "ROLE_INSTRUCTOR", "ROLE_GRAD_STUDENT"),
        rolesFor("all@ucsb.edu"));
  }

  @Test
  public void managed_roles_covers_every_role_this_service_grants() {
    noRolesInDb();
    when(adminRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);
    when(gradStudentRepository.existsByEmail("all@ucsb.edu")).thenReturn(true);

    // Whatever the service can grant, the interceptor must know to strip.
    assertTrue(RoleAssignmentService.MANAGED_ROLES.containsAll(rolesFor("all@ucsb.edu")));
    assertTrue(RoleAssignmentService.MANAGED_ROLES.containsAll(rolesFor("cgaucho@ucsb.edu")));
  }

  // ---- who may use the app at all ----

  @Test
  public void an_undergrad_is_granted_access() {
    noRolesInDb();
    assertTrue(RoleAssignmentService.grantsAccess(service.authoritiesFor("cgaucho@ucsb.edu")));
  }

  /** The case the login gate exists for: a Google account with no role here. */
  @Test
  public void a_user_with_only_role_user_is_denied_access() {
    noRolesInDb();
    assertFalse(RoleAssignmentService.grantsAccess(service.authoritiesFor("someone@gmail.com")));
  }

  /**
   * Non-UCSB addresses are deliberately allowed in the admin, instructor and grad student tables,
   * which is useful for testing; only ROLE_UNDERGRAD requires a UCSB address.
   */
  @Test
  public void a_non_ucsb_address_in_a_role_table_still_gets_its_role_and_access() {
    noRolesInDb();
    when(adminRepository.existsByEmail("tester@gmail.com")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("tester@gmail.com"));
    assertTrue(RoleAssignmentService.grantsAccess(service.authoritiesFor("tester@gmail.com")));

    noRolesInDb();
    when(instructorRepository.existsByEmail("prof@gmail.com")).thenReturn(true);
    assertTrue(RoleAssignmentService.grantsAccess(service.authoritiesFor("prof@gmail.com")));

    noRolesInDb();
    when(gradStudentRepository.existsByEmail("grad@gmail.com")).thenReturn(true);
    assertTrue(RoleAssignmentService.grantsAccess(service.authoritiesFor("grad@gmail.com")));
  }

  @Test
  public void role_user_alone_does_not_grant_access() {
    assertFalse(
        RoleAssignmentService.grantsAccess(
            Set.of(
                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                    "ROLE_USER"))));
  }

  @Test
  public void each_access_role_on_its_own_grants_access() {
    for (String role : RoleAssignmentService.ACCESS_ROLES) {
      assertTrue(
          RoleAssignmentService.grantsAccess(
              Set.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(role))),
          role + " should grant access");
    }
  }
}
