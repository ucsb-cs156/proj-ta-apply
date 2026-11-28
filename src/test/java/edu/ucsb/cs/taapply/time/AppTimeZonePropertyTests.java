package edu.ucsb.cs.taapply.time;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.services.SystemInfoService;
import java.time.ZoneId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Issue #513, end to end: starting the app with {@code app.timeZone} set changes the zone the
 * backend's clock uses and the zone the frontend is told about, with nothing else configured.
 */
@SpringBootTest(properties = "app.timeZone=Asia/Tokyo")
public class AppTimeZonePropertyTests {

  @Autowired private SystemInfoService systemInfoService;

  /** The zone is JVM-wide state; give the other test classes the default back. */
  @AfterAll
  public static void restore_the_default_app_zone() {
    AppTime.configure(AppTime.DEFAULT_ZONE);
  }

  @Test
  public void the_property_sets_the_zone_the_app_runs_in() {
    assertEquals(ZoneId.of("Asia/Tokyo"), AppTime.zone());
    assertEquals("Asia/Tokyo", ZoneId.systemDefault().getId());
  }

  @Test
  public void the_property_reaches_the_frontend_through_system_info() {
    assertEquals("Asia/Tokyo", systemInfoService.getSystemInfo().getTimeZone());
  }
}
