package edu.ucsb.cs.taapply.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;

import de.flapdoodle.os.CommonArchitecture;
import de.flapdoodle.os.CommonOS;
import de.flapdoodle.os.ImmutablePlatform;
import de.flapdoodle.os.Platform;
import de.flapdoodle.os.linux.CentosVersion;
import de.flapdoodle.os.linux.LinuxDistribution;
import de.flapdoodle.os.linux.UbuntuVersion;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

public class EmbeddedMongoPlatformTests {

  private static final String PROPERTY = EmbeddedMongoPlatform.OVERRIDE_PROPERTY;

  private String before;

  @BeforeEach
  public void saveProperty() {
    before = System.getProperty(PROPERTY);
    System.clearProperty(PROPERTY);
  }

  @AfterEach
  public void restoreProperty() {
    if (before == null) {
      System.clearProperty(PROPERTY);
    } else {
      System.setProperty(PROPERTY, before);
    }
  }

  private static ImmutablePlatform.Builder linux(CommonArchitecture architecture) {
    return ImmutablePlatform.builder().operatingSystem(CommonOS.Linux).architecture(architecture);
  }

  /** GitHub's Ubuntu 26.04 runners: Ubuntu, but no release flapdoodle recognises. */
  private static final Platform UNRECOGNISED_UBUNTU =
      linux(CommonArchitecture.X86_64).distribution(LinuxDistribution.Ubuntu).build();

  @Test
  public void the_property_and_release_are_flapdoodles() {
    assertEquals("de.flapdoodle.os.override", PROPERTY);
    // A name flapdoodle accepts: it is one of its Ubuntu releases.
    assertEquals(
        UbuntuVersion.Ubuntu_24_04,
        UbuntuVersion.valueOf(EmbeddedMongoPlatform.NEWEST_KNOWN_UBUNTU));
  }

  @Test
  public void an_unrecognised_ubuntu_release_is_treated_as_the_newest_known_one() {
    assertEquals(
        Optional.of("Linux|X86_64|Ubuntu|Ubuntu_24_04"),
        EmbeddedMongoPlatform.overrideFor(UNRECOGNISED_UBUNTU));
    assertEquals(
        Optional.of("Linux|ARM_64|Ubuntu|Ubuntu_24_04"),
        EmbeddedMongoPlatform.overrideFor(
            linux(CommonArchitecture.ARM_64).distribution(LinuxDistribution.Ubuntu).build()));
  }

  @Test
  public void the_override_is_one_flapdoodle_parses_back() {
    System.setProperty(PROPERTY, EmbeddedMongoPlatform.overrideFor(UNRECOGNISED_UBUNTU).get());
    Platform parsed = Platform.detect(CommonOS.list());
    assertEquals(CommonOS.Linux, parsed.operatingSystem());
    assertEquals(CommonArchitecture.X86_64, parsed.architecture());
    assertEquals(Optional.of(LinuxDistribution.Ubuntu), parsed.distribution());
    assertEquals(Optional.of(UbuntuVersion.Ubuntu_24_04), parsed.version());
  }

  @Test
  public void a_recognised_ubuntu_release_is_left_alone() {
    assertEquals(
        Optional.empty(),
        EmbeddedMongoPlatform.overrideFor(
            linux(CommonArchitecture.X86_64)
                .distribution(LinuxDistribution.Ubuntu)
                .version(UbuntuVersion.Ubuntu_22_04)
                .build()));
  }

  @Test
  public void other_systems_are_left_alone() {
    assertEquals(
        Optional.empty(),
        EmbeddedMongoPlatform.overrideFor(
            linux(CommonArchitecture.X86_64)
                .distribution(LinuxDistribution.CentOS)
                .version(CentosVersion.CentOS_7)
                .build()));
    // Another Linux whose release was not recognised either.
    assertEquals(
        Optional.empty(),
        EmbeddedMongoPlatform.overrideFor(
            linux(CommonArchitecture.X86_64).distribution(LinuxDistribution.CentOS).build()));
    assertEquals(
        Optional.empty(),
        EmbeddedMongoPlatform.overrideFor(linux(CommonArchitecture.X86_64).build()));
    assertEquals(
        Optional.empty(),
        EmbeddedMongoPlatform.overrideFor(
            ImmutablePlatform.builder()
                .operatingSystem(CommonOS.OS_X)
                .architecture(CommonArchitecture.ARM_64)
                .build()));
  }

  @Test
  public void on_an_unrecognised_ubuntu_the_override_is_set() {
    try (MockedStatic<Platform> platform =
        Mockito.mockStatic(Platform.class, Mockito.CALLS_REAL_METHODS)) {
      platform.when(() -> Platform.detect(any())).thenReturn(UNRECOGNISED_UBUNTU);
      EmbeddedMongoPlatform.useKnownUbuntuIfUnrecognised();
    }
    assertEquals("Linux|X86_64|Ubuntu|Ubuntu_24_04", System.getProperty(PROPERTY));
  }

  @Test
  public void elsewhere_the_override_is_not_set() {
    try (MockedStatic<Platform> platform =
        Mockito.mockStatic(Platform.class, Mockito.CALLS_REAL_METHODS)) {
      platform
          .when(() -> Platform.detect(any()))
          .thenReturn(
              linux(CommonArchitecture.X86_64)
                  .distribution(LinuxDistribution.Ubuntu)
                  .version(UbuntuVersion.Ubuntu_22_04)
                  .build());
      EmbeddedMongoPlatform.useKnownUbuntuIfUnrecognised();
    }
    assertNull(System.getProperty(PROPERTY));
  }

  @Test
  public void an_override_already_set_by_hand_is_kept() {
    System.setProperty(PROPERTY, "Linux|X86_64|Ubuntu|Ubuntu_22_04");
    try (MockedStatic<Platform> platform =
        Mockito.mockStatic(Platform.class, Mockito.CALLS_REAL_METHODS)) {
      EmbeddedMongoPlatform.useKnownUbuntuIfUnrecognised();
      platform.verify(() -> Platform.detect(any()), Mockito.never());
    }
    assertEquals("Linux|X86_64|Ubuntu|Ubuntu_22_04", System.getProperty(PROPERTY));
  }
}
