package edu.ucsb.cs.taapply.startup;

import static org.mockito.Mockito.*;

import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class ScaffoldStartupTests {

  @Mock private AdminRepository adminRepository;

  private ScaffoldStartup scaffoldStartup;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    scaffoldStartup = new ScaffoldStartup();
    scaffoldStartup.adminRepository = adminRepository;
    scaffoldStartup.adminEmails = List.of("phtcon@ucsb.edu", "admin2@ucsb.edu");
  }

  @Test
  void alwaysRunOnStartup_saves_all_admin_emails() {
    scaffoldStartup.alwaysRunOnStartup();

    verify(adminRepository).save(new Admin("phtcon@ucsb.edu"));
    verify(adminRepository).save(new Admin("admin2@ucsb.edu"));
    verifyNoMoreInteractions(adminRepository);
  }

  @Test
  void alwaysRunOnStartup_strips_whitespace_from_emails() {
    scaffoldStartup.adminEmails = List.of(" phtcon@ucsb.edu ");

    scaffoldStartup.alwaysRunOnStartup();

    verify(adminRepository).save(new Admin("phtcon@ucsb.edu"));
  }

  @Test
  void alwaysRunOnStartup_handles_repository_exception_gracefully() {
    doThrow(new RuntimeException("DB error")).when(adminRepository).save(any(Admin.class));

    // Should not throw — exception is caught and logged
    scaffoldStartup.alwaysRunOnStartup();

    verify(adminRepository, times(1)).save(any(Admin.class));
  }
}
