package edu.ucsb.cs.taapply.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Health")
@RestController
public class HealthController {

  @Operation(summary = "Health check – returns {\"status\":\"ok\"} when the service is running")
  @GetMapping("/api/health")
  public Map<String, String> healthCheck() {
    return Map.of("status", "ok");
  }
}
