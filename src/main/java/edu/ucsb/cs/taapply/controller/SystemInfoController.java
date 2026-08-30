package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.model.SystemInfo;
import edu.ucsb.cs.taapply.services.SystemInfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "System Information")
@RequestMapping("/api/systemInfo")
@RestController
public class SystemInfoController {

  @Autowired private SystemInfoService systemInfoService;

  @Operation(summary = "Get global information about the application")
  @GetMapping("")
  public SystemInfo getSystemInfo() {
    return systemInfoService.getSystemInfo();
  }
}
