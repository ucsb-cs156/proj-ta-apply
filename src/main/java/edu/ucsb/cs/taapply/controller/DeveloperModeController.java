package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.services.DeveloperModeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Developer Mode switch (issue #217): anyone, signed in or not, may ask whether it is on (the
 * footer badge is shown everywhere); only admins may flip it, and only where the environment flag
 * makes it available.
 */
@Tag(name = "Developer mode")
@RestController
public class DeveloperModeController extends ApiController {

  @Autowired DeveloperModeService developerModeService;

  @Operation(
      summary = "Whether developer mode is available on this instance, and whether it is on",
      description = "Open to everyone, so the footer badge can be shown on every page.")
  @GetMapping("/api/developerMode")
  public DeveloperModeService.Status status() {
    return developerModeService.status();
  }

  @Operation(
      summary = "Switch developer mode on or off",
      description =
          "Admins only. 404 when ENABLE_DEVELOPER_MODE is false on this instance, so the switch"
              + " cannot be turned on where the feature does not exist. Not audited.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/api/admin/developerMode")
  public DeveloperModeService.Status setOn(@Parameter(name = "on") @RequestParam boolean on) {
    return developerModeService.setOn(on);
  }
}
