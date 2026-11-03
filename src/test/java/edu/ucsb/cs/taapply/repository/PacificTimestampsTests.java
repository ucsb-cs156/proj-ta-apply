package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.TimeZone;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/**
 * Every stamped column is Pacific wall-clock time (issue #293), whatever zone the JVM has by the
 * time the row is saved, and it survives the trip through the database unshifted. Pacific differs
 * from UTC by seven or eight hours, so a stamp taken from the wrong zone could not pass for right.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class PacificTimestampsTests {

  @Autowired private TestEntityManager entityManager;
  @Autowired private ApplicationRepository applicationRepository;
  @Autowired private AuditTrailRepository auditTrailRepository;
  @Autowired private DraftApplicationRepository draftApplicationRepository;
  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private RecruitmentAuditTrailRepository recruitmentAuditTrailRepository;

  private TimeZone original;

  @BeforeEach
  void remember() {
    original = TimeZone.getDefault();
  }

  @AfterEach
  void restore() {
    TimeZone.setDefault(original);
  }

  private static void assertIsPacificNow(LocalDateTime stamp, String what) {
    assertTrue(stamp != null, what + " was stamped");
    LocalDateTime pacific = AppTime.now();
    assertTrue(
        Duration.between(stamp, pacific).abs().compareTo(Duration.ofMinutes(1)) < 0,
        what + " " + stamp + " is not Pacific now " + pacific);
  }

  private void flushAndForget() {
    entityManager.flush();
    entityManager.clear();
  }

  private Recruitment recruitment() {
    return recruitmentRepository.save(
        Recruitment.builder()
            .quarter("20261")
            .type(RecruitmentType.TA)
            .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
            .build());
  }

  // A zone change after startup is artificial (a real server has one zone from the start), but it
  // shows
  // the stamps come from AppTime and not from whatever zone the JVM happens to have.
  @ParameterizedTest
  @ValueSource(strings = {"UTC", "Asia/Tokyo", "America/New_York", "America/Los_Angeles"})
  public void rows_are_stamped_in_pacific_time_whatever_the_jvm_zone(String zone) {
    TimeZone.setDefault(TimeZone.getTimeZone(zone));
    Recruitment r = recruitment();

    Application application =
        applicationRepository.save(
            Application.builder().recruitmentId(r.getId()).email("a@ucsb.edu").build());
    AuditTrail audit =
        auditTrailRepository.save(
            AuditTrail.builder().taApplicationId(1L).fieldName("major").newValue("CS").build());
    RecruitmentAuditTrail recruitmentAudit =
        recruitmentAuditTrailRepository.save(
            RecruitmentAuditTrail.builder()
                .recruitmentId(r.getId())
                .whatChanged("status")
                .newValue("OPEN")
                .build());
    DraftApplication draft =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("d@ucsb.edu").build());
    flushAndForget();

    assertIsPacificNow(
        applicationRepository.findById(application.getId()).orElseThrow().getSubmittedAt(),
        "submittedAt");
    assertIsPacificNow(
        auditTrailRepository.findById(audit.getId()).orElseThrow().getEditedAt(), "editedAt");
    assertIsPacificNow(
        recruitmentAuditTrailRepository
            .findById(recruitmentAudit.getId())
            .orElseThrow()
            .getChangedAt(),
        "changedAt");
    assertIsPacificNow(
        draftApplicationRepository.findById(draft.getId()).orElseThrow().getUpdatedAt(),
        "updatedAt on insert");
  }

  @Test
  public void a_draft_is_restamped_when_it_is_saved_again() {
    Recruitment r = recruitment();
    DraftApplication draft =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("d@ucsb.edu").build());
    entityManager.flush();
    // pretend the first save was long ago, in a way the entity's own stamping does not undo
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "UPDATE draft_applications SET updated_at = TIMESTAMP '2020-01-01 00:00:00'")
        .executeUpdate();
    entityManager.clear();

    DraftApplication found = draftApplicationRepository.findById(draft.getId()).orElseThrow();
    assertEquals(LocalDateTime.of(2020, 1, 1, 0, 0), found.getUpdatedAt());
    found.setFirstName("Chris");
    draftApplicationRepository.save(found);
    flushAndForget();

    assertIsPacificNow(
        draftApplicationRepository.findById(draft.getId()).orElseThrow().getUpdatedAt(),
        "updatedAt on update");
  }

  @Test
  public void a_stamp_is_stored_and_read_back_as_the_same_wall_clock_time() {
    Recruitment r = recruitment();
    r.setCreatedAt(LocalDateTime.of(2026, 11, 1, 19, 30));
    r.setLastPopulatedAt(LocalDateTime.of(2026, 3, 8, 1, 59, 59));
    recruitmentRepository.save(r);
    flushAndForget();

    Recruitment found = recruitmentRepository.findById(r.getId()).orElseThrow();
    assertEquals(LocalDateTime.of(2026, 11, 1, 19, 30), found.getCreatedAt());
    assertEquals(LocalDateTime.of(2026, 3, 8, 1, 59, 59), found.getLastPopulatedAt());
    Object stored =
        entityManager
            .getEntityManager()
            .createNativeQuery("SELECT CAST(created_at AS VARCHAR) FROM recruitments WHERE id = ?1")
            .setParameter(1, r.getId())
            .getSingleResult();
    assertTrue(stored.toString().startsWith("2026-11-01 19:30"), stored.toString());
  }
}
