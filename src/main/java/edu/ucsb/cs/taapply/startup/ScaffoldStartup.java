package edu.ucsb.cs.taapply.startup;

import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Seeds the admins table from ADMIN_EMAILS on every startup, so that users listed there get
 * ROLE_ADMIN on login without first needing to be added manually through the Admins page.
 */
@Slf4j
@Component
public class ScaffoldStartup {

  @Value("#{'${app.admin.emails}'.split(',')}")
  List<String> adminEmails;

  @Autowired AdminRepository adminRepository;

  public void alwaysRunOnStartup() {
    log.info("ScaffoldStartup.alwaysRunOnStartup called");

    try {
      adminEmails.forEach(
          (email) -> {
            Admin admin = new Admin(email.strip());
            adminRepository.save(admin);
          });
    } catch (Exception e) {
      log.error("Error loading ADMIN_EMAILS into admins table:", e);
    }
  }
}
