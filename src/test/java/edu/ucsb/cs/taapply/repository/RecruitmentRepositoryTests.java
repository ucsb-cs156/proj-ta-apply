package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
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
  @Autowired private JdbcTemplate jdbcTemplate;

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
    assertEquals("NotStarted", found.getReviewStatus());
    assertEquals(LocalDate.of(2026, 1, 5), found.getTentativeOpeningDate());
    assertEquals(LocalDate.of(2026, 1, 20), found.getPrimaryConsiderationDate());
    // Nothing has happened yet, so neither actual date is set.
    assertEquals(null, found.getActualOpeningDate());
    assertEquals(null, found.getActualClosingDate());
    assertEquals(null, found.getFacultyReviewOpeningDate());
    assertEquals(null, found.getFacultyRankingDeadline());
  }

  @Test
  public void the_database_defaults_existing_and_directly_inserted_rows_to_not_started_reviews() {
    jdbcTemplate.update(
        "INSERT INTO recruitments (quarter, type, application_status) VALUES (?, ?, ?)",
        "20261",
        "TA",
        "CLOSED");

    Map<String, Object> row =
        jdbcTemplate.queryForMap(
            "SELECT review_status, faculty_review_opening_date, faculty_ranking_deadline"
                + " FROM recruitments WHERE quarter = ? AND type = ?",
            "20261",
            "TA");

    assertEquals("NotStarted", row.get("review_status"));
    assertEquals(null, row.get("faculty_review_opening_date"));
    assertEquals(null, row.get("faculty_ranking_deadline"));
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
            .enrollCode("07492")
            .section("0100")
            .title("ADV APP PROGRAM")
            .instructor("CONRAD P")
            .days("T R")
            .time("2:00 PM - 3:15 PM")
            .room("PHELP 3526")
            .status("open")
            .summerSession("A")
            .build());

    RecruitmentCourse found =
        recruitmentCourseRepository
            .findByRecruitmentIdAndEnrollCode(r.getId(), "07492")
            .orElseThrow();

    assertEquals("CMPSC   156", found.getCourseId());
    assertEquals("0100", found.getSection());
    assertEquals("ADV APP PROGRAM", found.getTitle());
    assertEquals("CONRAD P", found.getInstructor());
    assertEquals("T R", found.getDays());
    assertEquals("2:00 PM - 3:15 PM", found.getTime());
    assertEquals("PHELP 3526", found.getRoom());
    // The enrollment figures are not the row's since issue #363 (they are in budget_courses).
    assertNull(found.getEnrollment());
    assertNull(found.getMaxEnroll());
    assertNull(found.getEnrollmentEstimate());
    assertEquals("open", found.getStatus());
    assertEquals("A", found.getSummerSession());
    assertFalse(found.isRemoved());
    // The padded id survives the round trip; it is the sort key.
    assertEquals("CMPSC   156", found.getCourseId());
  }

  /**
   * Two lectures of one course are two rows: they are planned separately, often have different
   * instructors, and their enrollments drive position counts independently.
   */
  @Test
  public void a_course_may_appear_once_per_primary_section() {
    Recruitment r = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));

    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(r.getId())
            .courseId("CMPSC   156")
            .enrollCode("07492")
            .section("0100")
            .instructor("CONRAD P")
            .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(r.getId())
            .courseId("CMPSC   156")
            .enrollCode("07500")
            .section("0200")
            .instructor("SOMEONE ELSE")
            .build());
    entityManager.flush();

    List<RecruitmentCourse> rows = recruitmentCourseRepository.findByRecruitmentId(r.getId());
    assertEquals(2, rows.size());
    assertEquals(
        List.of("CONRAD P", "SOMEONE ELSE"),
        rows.stream().map(RecruitmentCourse::getInstructor).sorted().toList());
  }

  @Test
  public void the_same_primary_section_cannot_be_added_to_one_recruitment_twice() {
    Recruitment r = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    RecruitmentCourse first =
        RecruitmentCourse.builder()
            .recruitmentId(r.getId())
            .courseId("CMPSC   156")
            .enrollCode("07492")
            .build();
    RecruitmentCourse duplicate =
        RecruitmentCourse.builder()
            .recruitmentId(r.getId())
            .courseId("CMPSC   156")
            .enrollCode("07492")
            .build();

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
        RecruitmentCourse.builder()
            .recruitmentId(ta.getId())
            .courseId("CMPSC   156")
            .enrollCode("07492")
            .build());
    recruitmentCourseRepository.save(
        RecruitmentCourse.builder()
            .recruitmentId(ula.getId())
            .courseId("CMPSC     1A")
            .enrollCode("07500")
            .build());

    List<RecruitmentCourse> taCourses = recruitmentCourseRepository.findByRecruitmentId(ta.getId());
    assertEquals(1, taCourses.size());
    assertEquals("CMPSC   156", taCourses.get(0).getCourseId());
  }

  // ---- the assignments version (issue #280) ----

  private int assignmentsVersionOf(Long id) {
    entityManager.flush();
    entityManager.clear();
    return recruitmentRepository.findById(id).orElseThrow().getAssignmentsVersion();
  }

  @Test
  public void a_new_recruitment_starts_at_assignments_version_1() {
    Recruitment saved = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    assertEquals(1, assignmentsVersionOf(saved.getId()));
  }

  @Test
  public void the_database_defaults_a_directly_inserted_row_to_assignments_version_1() {
    jdbcTemplate.update(
        "INSERT INTO recruitments (quarter, type, application_status) VALUES (?, ?, ?)",
        "20262",
        "TA",
        "CLOSED");
    Long id =
        jdbcTemplate.queryForObject(
            "SELECT id FROM recruitments WHERE quarter = ?", Long.class, "20262");
    assertEquals(1, assignmentsVersionOf(id));
  }

  @Test
  public void the_version_counts_up_only_if_it_is_still_the_one_expected() {
    Long id = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA)).getId();

    assertEquals(1, recruitmentRepository.bumpAssignmentsVersionIf(id, 1));
    assertEquals(2, assignmentsVersionOf(id));

    // A stale expectation changes nothing.
    assertEquals(0, recruitmentRepository.bumpAssignmentsVersionIf(id, 1));
    assertEquals(2, assignmentsVersionOf(id));
    assertEquals(1, recruitmentRepository.bumpAssignmentsVersionIf(id, 2));
    assertEquals(3, assignmentsVersionOf(id));
  }

  @Test
  public void the_version_counts_up_for_one_recruitment_only() {
    Long id = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA)).getId();
    Long other = recruitmentRepository.save(recruitment("20261", RecruitmentType.ULA)).getId();

    assertEquals(1, recruitmentRepository.bumpAssignmentsVersion(id));
    assertEquals(1, recruitmentRepository.bumpAssignmentsVersion(id));

    assertEquals(3, assignmentsVersionOf(id));
    assertEquals(1, assignmentsVersionOf(other));
    assertEquals(0, recruitmentRepository.bumpAssignmentsVersionIf(-5L, 1));
    assertEquals(0, recruitmentRepository.bumpAssignmentsVersion(-5L));
  }

  @Test
  public void saving_a_stale_copy_of_the_recruitment_does_not_move_the_version_back() {
    Recruitment stale = recruitmentRepository.save(recruitment("20261", RecruitmentType.TA));
    entityManager.flush();
    recruitmentRepository.bumpAssignmentsVersion(stale.getId());

    stale.setReviewStatus("Open");
    recruitmentRepository.save(stale);

    assertEquals(2, assignmentsVersionOf(stale.getId()));
  }
}
