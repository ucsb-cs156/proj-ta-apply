package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.repository.GlobalSettingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** The global_settings table through the Liquibase schema (issue #217). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class GlobalSettingPersistenceTests {
  @Autowired GlobalSettingRepository settings;
  @Autowired TestEntityManager entityManager;

  @Test
  void a_setting_round_trips_by_key_and_can_be_changed() {
    settings.save(GlobalSetting.builder().key("developerMode").value("On").build());
    entityManager.flush();
    entityManager.clear();

    GlobalSetting found = settings.findById("developerMode").orElseThrow();
    assertEquals("On", found.getValue());
    assertTrue(settings.findById("somethingElse").isEmpty());

    found.setValue("Off");
    settings.save(found);
    entityManager.flush();
    entityManager.clear();
    assertEquals("Off", settings.findById("developerMode").orElseThrow().getValue());
    assertEquals(1, settings.count());
  }
}
