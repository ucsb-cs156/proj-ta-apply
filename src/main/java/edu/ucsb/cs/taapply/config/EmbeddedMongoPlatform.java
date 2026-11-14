package edu.ucsb.cs.taapply.config;

import de.flapdoodle.os.CommonOS;
import de.flapdoodle.os.Platform;
import de.flapdoodle.os.linux.LinuxDistribution;
import java.util.Optional;

/**
 * Lets the embedded MongoDB (MongoDevConfig) start on an Ubuntu release newer than flapdoodle knows
 * about. GitHub's ubuntu-latest runners moved to Ubuntu 26.04 in November 2026; flapdoodle then
 * detects "Ubuntu" with no version, finds no MongoDB package for it, and every test that needs
 * MongoDB fails to start. On such a machine this tells flapdoodle, through its own {@value
 * #OVERRIDE_PROPERTY} system property, to treat it as the newest Ubuntu release it does know, which
 * resolves to the same MongoDB build the runners used before. Anything else (a recognised Ubuntu,
 * another Linux, macOS, Windows, or an override already set by hand) is left alone.
 */
public final class EmbeddedMongoPlatform {

  /**
   * flapdoodle's override, read by {@code Platform.detect}: {@code OS|Architecture|Dist|Version}.
   */
  public static final String OVERRIDE_PROPERTY = "de.flapdoodle.os.override";

  /** The newest Ubuntu release flapdoodle knows; its MongoDB packages run on newer releases. */
  static final String NEWEST_KNOWN_UBUNTU = "Ubuntu_24_04";

  private EmbeddedMongoPlatform() {}

  /** Sets the override if this machine needs it and none has been set. */
  public static void useKnownUbuntuIfUnrecognised() {
    if (System.getProperty(OVERRIDE_PROPERTY) == null) {
      overrideFor(Platform.detect(CommonOS.list()))
          .ifPresent(override -> System.setProperty(OVERRIDE_PROPERTY, override));
    }
  }

  /**
   * The override for a detected platform: for Ubuntu whose release was not recognised, the same
   * operating system and architecture as the newest known Ubuntu release; otherwise none.
   */
  static Optional<String> overrideFor(Platform platform) {
    boolean ubuntu = platform.distribution().orElse(null) == LinuxDistribution.Ubuntu;
    if (!ubuntu || platform.version().isPresent()) {
      return Optional.empty();
    }
    return Optional.of(
        String.join(
            "|",
            String.valueOf(platform.operatingSystem()),
            String.valueOf(platform.architecture()),
            String.valueOf(LinuxDistribution.Ubuntu),
            NEWEST_KNOWN_UBUNTU));
  }
}
