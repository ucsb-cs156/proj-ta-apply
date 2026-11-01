package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.GlobalSetting;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.GlobalSettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The Developer Mode switch (issue #217). Two gates: the {@code ENABLE_DEVELOPER_MODE} environment
 * flag says whether the feature exists on this instance at all (it must stay false in production),
 * and the {@code developerMode} row of {@code global_settings} says whether it is switched on. A
 * later feature counts as enabled only when both hold, so a database edit alone can never turn fake
 * data on where the flag is off.
 */
@Service
public class DeveloperModeService {

  /** The setting's key in {@code global_settings}. */
  public static final String SETTING_KEY = "developerMode";

  public static final String ON = "On";
  public static final String OFF = "Off";

  @Value("${app.enableDeveloperMode:false}")
  private boolean enableDeveloperMode;

  @Autowired GlobalSettingRepository globalSettingRepository;

  /** What the frontend needs: whether the switch exists here, and whether it is on. */
  public record Status(boolean available, boolean on) {}

  /** Whether the environment flag makes the switch available on this instance. */
  public boolean isAvailable() {
    return enableDeveloperMode;
  }

  /** Whether developer mode is switched on: available, and the setting is "On". */
  public boolean isOn() {
    return isAvailable()
        && globalSettingRepository
            .findById(SETTING_KEY)
            .map(setting -> ON.equals(setting.getValue()))
            .orElse(false);
  }

  public Status status() {
    return new Status(isAvailable(), isOn());
  }

  /**
   * Switches developer mode on or off.
   *
   * @throws EntityNotFoundException when the switch is not available on this instance
   */
  public Status setOn(boolean on) {
    if (!isAvailable()) {
      throw new EntityNotFoundException("Developer mode is not enabled on this instance");
    }
    GlobalSetting setting =
        globalSettingRepository
            .findById(SETTING_KEY)
            .orElseGet(() -> GlobalSetting.builder().key(SETTING_KEY).build());
    setting.setValue(on ? ON : OFF);
    globalSettingRepository.save(setting);
    return status();
  }
}
