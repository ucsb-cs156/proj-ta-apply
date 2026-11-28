package edu.ucsb.cs.taapply.time;

import java.time.DateTimeException;
import java.time.ZoneId;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

/**
 * Reads the {@code app.timeZone} property as the application starts and hands it to {@link
 * AppTime#configure} (issue #513). It is registered in {@code META-INF/spring.factories}, so it
 * runs after the environment (properties, environment variables, {@code .env}) is read and before
 * any bean exists, in the app and in every Spring test alike: Liquibase, Hibernate and the
 * scheduler all find the zone already set.
 *
 * <p>A value that is not a zone id fails startup with a message naming it, rather than quietly
 * running in the wrong zone.
 */
@Slf4j
public class AppTimeInitializer
    implements ApplicationContextInitializer<ConfigurableApplicationContext> {

  /** The property that names the app's zone; an IANA id such as {@code America/Los_Angeles}. */
  public static final String PROPERTY = "app.timeZone";

  @Override
  public void initialize(ConfigurableApplicationContext applicationContext) {
    AppTime.configure(zoneFrom(applicationContext.getEnvironment()));
    log.info("The app's time zone is {}", AppTime.zone());
  }

  /** The zone the environment names, or the default when it names none. */
  static ZoneId zoneFrom(Environment environment) {
    String id = environment.getProperty(PROPERTY, AppTime.DEFAULT_ZONE_ID).trim();
    if (id.isEmpty()) {
      return AppTime.DEFAULT_ZONE;
    }
    try {
      return ZoneId.of(id);
    } catch (DateTimeException e) {
      throw new IllegalStateException(
          PROPERTY + "=" + id + " is not a time zone id (expected one like America/Los_Angeles)",
          e);
    }
  }
}
