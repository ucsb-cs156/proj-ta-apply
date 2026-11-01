package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.GlobalSetting;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.GlobalSettingRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService.Status;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(classes = {DeveloperModeService.class})
@ActiveProfiles("test")
public class DeveloperModeServiceTests {

  @Autowired DeveloperModeService service;
  @MockitoBean GlobalSettingRepository globalSettingRepository;

  private static GlobalSetting setting(String value) {
    return GlobalSetting.builder().key("developerMode").value(value).build();
  }

  private void available(boolean available) {
    ReflectionTestUtils.setField(service, "enableDeveloperMode", available);
  }

  @Test
  public void the_setting_key_and_values_are_as_the_design_says() {
    assertEquals("developerMode", DeveloperModeService.SETTING_KEY);
    assertEquals("On", DeveloperModeService.ON);
    assertEquals("Off", DeveloperModeService.OFF);
  }

  @Test
  public void not_available_means_off_whatever_the_table_says() {
    available(false);
    when(globalSettingRepository.findById("developerMode")).thenReturn(Optional.of(setting("On")));

    assertFalse(service.isAvailable());
    assertFalse(service.isOn());
    assertEquals(new Status(false, false), service.status());
  }

  @Test
  public void available_but_no_row_means_off() {
    available(true);
    when(globalSettingRepository.findById("developerMode")).thenReturn(Optional.empty());

    assertTrue(service.isAvailable());
    assertFalse(service.isOn());
    assertEquals(new Status(true, false), service.status());
  }

  @Test
  public void available_and_row_off_means_off() {
    available(true);
    when(globalSettingRepository.findById("developerMode")).thenReturn(Optional.of(setting("Off")));

    assertFalse(service.isOn());
    assertEquals(new Status(true, false), service.status());
  }

  @Test
  public void available_and_row_on_means_on() {
    available(true);
    when(globalSettingRepository.findById("developerMode")).thenReturn(Optional.of(setting("On")));

    assertTrue(service.isOn());
    assertEquals(new Status(true, true), service.status());
  }

  @Test
  public void a_row_with_any_other_value_means_off() {
    available(true);
    when(globalSettingRepository.findById("developerMode")).thenReturn(Optional.of(setting("on")));

    assertFalse(service.isOn());
  }

  @Test
  public void switching_on_creates_the_row_when_there_is_none() {
    available(true);
    when(globalSettingRepository.findById("developerMode"))
        .thenReturn(Optional.empty())
        .thenReturn(Optional.of(setting("On")));

    Status status = service.setOn(true);

    ArgumentCaptor<GlobalSetting> saved = ArgumentCaptor.forClass(GlobalSetting.class);
    verify(globalSettingRepository).save(saved.capture());
    assertEquals("developerMode", saved.getValue().getKey());
    assertEquals("On", saved.getValue().getValue());
    assertEquals(new Status(true, true), status);
  }

  @Test
  public void switching_off_updates_the_existing_row() {
    available(true);
    GlobalSetting existing = setting("On");
    when(globalSettingRepository.findById("developerMode"))
        .thenReturn(Optional.of(existing))
        .thenReturn(Optional.of(existing));

    Status status = service.setOn(false);

    verify(globalSettingRepository).save(existing);
    assertEquals("Off", existing.getValue());
    assertEquals(new Status(true, false), status);
  }

  @Test
  public void switching_is_refused_where_the_feature_is_not_available() {
    available(false);

    EntityNotFoundException e =
        assertThrows(EntityNotFoundException.class, () -> service.setOn(true));

    assertEquals("Developer mode is not enabled on this instance", e.getMessage());
    verify(globalSettingRepository, never()).save(any());
  }
}
