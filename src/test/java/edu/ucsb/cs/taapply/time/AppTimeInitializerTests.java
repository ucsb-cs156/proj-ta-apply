package edu.ucsb.cs.taapply.time;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.ZoneId;
import java.util.TimeZone;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.SpringFactoriesLoader;
import org.springframework.mock.env.MockEnvironment;

/** Issue #513: the app's zone comes from the one property, read as the app starts. */
public class AppTimeInitializerTests {

  private TimeZone original;

  @BeforeEach
  public void remember_the_default_zone() {
    original = TimeZone.getDefault();
  }

  @AfterEach
  public void restore_the_default_zone_and_the_default_app_zone() {
    AppTime.configure(AppTime.DEFAULT_ZONE);
    TimeZone.setDefault(original);
  }

  @Test
  public void the_property_is_app_timeZone() {
    assertEquals("app.timeZone", AppTimeInitializer.PROPERTY);
  }

  @Test
  public void with_no_property_the_zone_is_the_default() {
    assertEquals(AppTime.DEFAULT_ZONE, AppTimeInitializer.zoneFrom(new MockEnvironment()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "   "})
  public void a_blank_property_means_the_default(String value) {
    MockEnvironment environment = new MockEnvironment().withProperty("app.timeZone", value);
    assertEquals(AppTime.DEFAULT_ZONE, AppTimeInitializer.zoneFrom(environment));
  }

  @ParameterizedTest
  @ValueSource(strings = {"Asia/Tokyo", " Asia/Tokyo ", "America/New_York", "UTC"})
  public void the_property_names_the_zone(String value) {
    MockEnvironment environment = new MockEnvironment().withProperty("app.timeZone", value);
    assertEquals(ZoneId.of(value.trim()), AppTimeInitializer.zoneFrom(environment));
  }

  @Test
  public void a_value_that_is_not_a_zone_fails_startup_naming_it() {
    MockEnvironment environment =
        new MockEnvironment().withProperty("app.timeZone", "Pacific Time");
    IllegalStateException e =
        assertThrows(IllegalStateException.class, () -> AppTimeInitializer.zoneFrom(environment));
    assertEquals(
        "app.timeZone=Pacific Time is not a time zone id (expected one like America/Los_Angeles)",
        e.getMessage());
  }

  @Test
  public void initializing_configures_app_time_and_the_jvm_default_from_the_environment() {
    TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);
    when(context.getEnvironment())
        .thenReturn(new MockEnvironment().withProperty("app.timeZone", "Asia/Tokyo"));

    new AppTimeInitializer().initialize(context);

    assertEquals(ZoneId.of("Asia/Tokyo"), AppTime.zone());
    assertEquals("Asia/Tokyo", TimeZone.getDefault().getID());
  }

  /** The registration in META-INF/spring.factories is what makes it run; keep it there. */
  @Test
  public void it_is_registered_as_an_application_context_initializer() {
    assertTrue(
        SpringFactoriesLoader.forDefaultResourceLocation(getClass().getClassLoader())
            .load(ApplicationContextInitializer.class)
            .stream()
            .anyMatch(AppTimeInitializer.class::isInstance));
  }

  /**
   * End to end, the way the app starts: a Spring application started with the property runs in that
   * zone, with nothing else told. No database: H2 remembers the JVM zone it first saw for the rest
   * of the test run, so a context with a datasource started in Tokyo would shift every timestamp
   * the later test classes read back.
   */
  @Test
  public void a_spring_application_started_with_the_property_runs_in_that_zone() {
    try (ConfigurableApplicationContext context =
        new SpringApplicationBuilder(Nothing.class)
            .web(WebApplicationType.NONE)
            .logStartupInfo(false)
            // a command-line argument outranks the test application.properties
            .run("--app.timeZone=Asia/Tokyo")) {
      assertTrue(context.isActive());
      assertEquals(ZoneId.of("Asia/Tokyo"), AppTime.zone());
      assertEquals("Asia/Tokyo", TimeZone.getDefault().getID());
    }
  }

  @Configuration
  static class Nothing {}
}
