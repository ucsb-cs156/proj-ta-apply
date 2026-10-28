package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
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

  private Set<String> rolesFor(String email) {
    return service.authoritiesFor(email).stream()
        .map(GrantedAuthority::getAuthority)
        .collect(Collectors.toSet());
  }

  private void noRolesInDb() {
    when(adminRepository.existsByEmail(org.mockito.ArgumentMatchers.any())).thenReturn(false);
    when(instructorRepository.existsByEmail(org.mockito.ArgumentMatchers.any())).thenReturn(false);
  }

  private static Set<GrantedAuthority> authorities(String... roles) {
    return Set.of(roles).stream()
        .map(SimpleGrantedAuthority::new)
        .collect(Collectors.toUnmodifiableSet());
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

  /** There is no applicant role: a UCSB user with no other role holds just ROLE_USER. */
  @Test
  public void a_ucsb_user_with_no_other_role_is_just_a_user() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER"), rolesFor("cgaucho@ucsb.edu"));
  }

  @Test
  public void a_non_ucsb_user_with_no_other_role_is_just_a_user() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER"), rolesFor("someone@gmail.com"));
  }

  @Test
  public void an_admin_in_the_table_gets_admin() {
    noRolesInDb();
    when(adminRepository.existsByEmail("admin@ucsb.edu")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("admin@ucsb.edu"));
  }

  @Test
  public void an_instructor_in_the_table_gets_instructor() {
    noRolesInDb();
    when(instructorRepository.existsByEmail("prof@ucsb.edu")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_INSTRUCTOR"), rolesFor("prof@ucsb.edu"));
  }

  /** An email in app.admin.emails is an admin even with no row in the admins table. */
  @Test
  public void the_bootstrap_admin_email_gets_admin() {
    noRolesInDb();
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("bootstrap@ucsb.edu"));
  }

  @Test
  public void admin_and_instructor_are_independent() {
    noRolesInDb();
    when(adminRepository.existsByEmail("both@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("both@ucsb.edu")).thenReturn(true);

    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN", "ROLE_INSTRUCTOR"), rolesFor("both@ucsb.edu"));
  }

  @Test
  public void managed_roles_covers_every_role_this_service_grants() {
    noRolesInDb();
    when(adminRepository.existsByEmail("both@ucsb.edu")).thenReturn(true);
    when(instructorRepository.existsByEmail("both@ucsb.edu")).thenReturn(true);

    // Whatever the service can grant, the interceptor must know to strip.
    assertTrue(RoleAssignmentService.MANAGED_ROLES.containsAll(rolesFor("both@ucsb.edu")));
    assertTrue(RoleAssignmentService.MANAGED_ROLES.containsAll(rolesFor("cgaucho@ucsb.edu")));
    assertEquals(
        Set.of("ROLE_USER", "ROLE_ADMIN", "ROLE_INSTRUCTOR"), RoleAssignmentService.MANAGED_ROLES);
  }

  // ---- who may use the app at all ----

  /** Any UCSB address may use the app: such a user is an applicant. */
  @Test
  public void a_ucsb_user_with_only_role_user_is_granted_access() {
    assertTrue(RoleAssignmentService.grantsAccess("cgaucho@ucsb.edu", authorities("ROLE_USER")));
    assertTrue(
        RoleAssignmentService.grantsAccess("cgaucho@umail.ucsb.edu", authorities("ROLE_USER")));
  }

  /** The case the login gate exists for: an outside Google account with no role here. */
  @Test
  public void an_outside_user_with_only_role_user_is_denied_access() {
    assertFalse(RoleAssignmentService.grantsAccess("someone@gmail.com", authorities("ROLE_USER")));
    assertFalse(RoleAssignmentService.grantsAccess(null, authorities("ROLE_USER")));
  }

  /**
   * Non-UCSB addresses are deliberately allowed in the admin and instructor tables, which is useful
   * for testing, and each of those roles grants access on its own.
   */
  @Test
  public void an_outside_admin_or_instructor_is_granted_access() {
    noRolesInDb();
    when(adminRepository.existsByEmail("tester@gmail.com")).thenReturn(true);
    assertEquals(Set.of("ROLE_USER", "ROLE_ADMIN"), rolesFor("tester@gmail.com"));
    assertTrue(
        RoleAssignmentService.grantsAccess(
            "tester@gmail.com", service.authoritiesFor("tester@gmail.com")));

    assertTrue(
        RoleAssignmentService.grantsAccess(
            "prof@gmail.com", authorities("ROLE_USER", "ROLE_INSTRUCTOR")));
    assertTrue(RoleAssignmentService.grantsAccess("x@gmail.com", authorities("ROLE_ADMIN")));
    assertTrue(RoleAssignmentService.grantsAccess("x@gmail.com", authorities("ROLE_INSTRUCTOR")));
  }

  @Test
  public void an_unknown_role_does_not_grant_access() {
    assertFalse(
        RoleAssignmentService.grantsAccess(
            "someone@gmail.com", authorities("ROLE_USER", "ROLE_CUSTOM")));
    assertEquals(Set.of("ROLE_ADMIN", "ROLE_INSTRUCTOR"), RoleAssignmentService.ACCESS_ROLES);
  }
}
