package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/**
 * Exercises the entities against the real Liquibase-built schema, so an entity and its changeset
 * cannot drift apart: a misspelled column, a missing constraint, or a column name the database
 * dislikes shows up here rather than at runtime.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class RecruitmentRepositoryTests {

  // Repositories extend CrudRepository (the convention in this app), which has no
  // saveAndFlush, so constraint violations are forced with an explicit flush.
  @Autowired private TestEntityManager entityManager;

  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;

  private Recruitment recruitment(String quarter, RecruitmentType type) {
    return Recruitment.builder()
        .quarter(quarter)
        .type(type)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .build();
  }

  @BeforeEach
  void clean() {
    recruitmentCourseRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  @Test
  public void a_recruitment_round_trips_and_defaults_to_closed() {
    Recruitment saved = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));

    Recruitment found = recruitmentRepository.findById(saved.getId()).orElseThrow();
    assertEquals("20261", found.getQuarter());
    assertEquals(RecruitmentType.TA, found.getType());
    assertEquals(ApplicationStatus.CLOSED, found.getApplicationStatus());
    assertEquals(LocalDate.of(2026, 1, 5), found.getTentativeOpeningDate());
    assertEquals(LocalDate.of(2026, 1, 20), found.getPrimaryConsiderationDate());
    // Nothing has happened yet, so neither actual date is set.
    assertEquals(null, found.getActualOpeningDate());
    assertEquals(null, found.getActualClosingDate());
  }

  @Test
  public void the_same_quarter_may_have_both_a_ta_and_a_ula_recruitment() {
    recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    recruitmentRepository.save(recruitment("20261", RecruitmentType.ULA));

    assertTrue(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.TA));
    assertTrue(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.ULA));
  }

  /** The unique constraint is what makes "the TA recruitment for W26" unambiguous. */
  @Test
  public void a_duplicate_quarter_and_type_is_rejected_by_the_database() {
    recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
          entityManager.flush();
        });
  }

  @Test
  public void findByQuarterAndType_finds_only_the_matching_one() {
    recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    recruitmentRepository.save(recruitment("20262", RecruitmentType.TA));

    assertEquals(
        "20261",
        recruitmentRepository
            .findByQuarterAndType("20261", RecruitmentType.TA)
            .orElseThrow()
            .getQuarter());
    assertFalse(
        recruitmentRepository.findByQuarterAndType("20263", RecruitmentType.TA).isPresent());
  }

  @Test
  public void recruitments_list_most_recent_quarter_first() {
    recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    recruitmentRepository.save(recruitment("20263", RecruitmentType.TA));
    recruitmentRepository.save(recruitment("20262", RecruitmentType.TA));

    List<String> quarters =
        recruitmentRepository.findAllByOrderByQuarterDescTypeAsc().stream()
            .map(Recruitment::getQuarter)
            .toList();

    assertEquals(List.of("20263", "20262", "20261"), quarters);
  }

  /** Round-trips every column, including ones a database might object to, like "time". */
  @Test
  public void a_recruitment_course_round_trips_all_of_its_columns() {
    Recruitment r = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));

    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(r.getId())
            .courseId("CMPSC   156")
            .title("ADV APP PROGRAM")
            .instructor("CONRAD P")
            .days("T R")
            .time("2:00 PM - 3:15 PM")
            .room("PHELP 3526")
            .enrollment(120)
            .maxEnroll(150)
            .status("open")
            .summerSession("A")
            .build());

    RecruitmentCourse found =
        recruitmentCourseRepository
            .findByRecruitmentIdAndCourseId(r.getId(), "CMPSC   156")
            .orElseThrow();

    assertEquals("ADV APP PROGRAM", found.getTitle());
    assertEquals("CONRAD P", found.getInstructor());
    assertEquals("T R", found.getDays());
    assertEquals("2:00 PM - 3:15 PM", found.getTime());
    assertEquals("PHELP 3526", found.getRoom());
    assertEquals(120, found.getEnrollment());
    assertEquals(150, found.getMaxEnroll());
    assertEquals("open", found.getStatus());
    assertEquals("A", found.getSummerSession());
    assertFalse(found.isRemoved());
    // The padded id survives the round trip; it is the sort key.
    assertEquals("CMPSC   156", found.getCourseId());
  }

  @Test
  public void the_same_course_cannot_be_added_to_one_recruitment_twice() {
    Recruitment r = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    RecruitmentCourse first =
        RecruitmentCourse.builder().recruitmentId(r.getId()).courseId("CMPSC   156").build();
    RecruitmentCourse duplicate =
        RecruitmentCourse.builder().recruitmentId(r.getId()).courseId("CMPSC   156").build();

    recruitmentCourseRepository.save(first);

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          recruitmentCourseRepository.save(duplicate);
          entityManager.flush();
        });
  }

  @Test
  public void findByRecruitmentId_returns_only_that_recruitments_courses() {
    Recruitment ta = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    Recruitment ula = recruitmentRepository.save(recruitment("20261", RecruitmentType.ULA));

    recruitmentCourseRepository.save(
        RecruitmentCourse.builder().recruitmentId(ta.getId()).courseId("CMPSC   156").build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder().recruitmentId(ula.getId()).courseId("CMPSC     1A").build());

    List<RecruitmentCourse> taCourses = recruitmentCourseRepository.findByRecruitmentId(ta.getId());
    assertEquals(1, taCourses.size());
    assertEquals("CMPSC   156", taCourses.get(0).getCourseId());
  }
}
