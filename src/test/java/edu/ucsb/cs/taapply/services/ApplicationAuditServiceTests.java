package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {ApplicationAuditService.class, ObjectMapper.class})
@ActiveProfiles("test")
public class ApplicationAuditServiceTests {

  @Autowired ApplicationAuditService service;
  @MockitoBean AuditTrailRepository auditTrailRepository;

  private static Application application() {
    return Application.builder()
        .id(7L)
        .recruitmentId(1L)
        .email("ada@ucsb.edu")
        .firstName("Ada")
        .lastName("Lovelace")
        .major("Computer Science")
        .gpaMajor(3.9)
        .classLevel(ClassLevel.PHD)
        .priorCoursework(
            new ArrayList<>(
                List.of(
                    PriorCoursework.builder()
                        .id(21L)
                        .ucsbCourse(true)
                        .courseNumber("CMPSC 130A")
                        .courseTitle("Data Structures")
                        .term("F25")
                        .grade("A")
                        .build())))
        .topicProficiencies(new HashMap<>(Map.of("Java", 4, "C++", 5)))
        .interests(new HashMap<>(Map.of("Tutoring", 5)))
        .courseInterests(new HashMap<>(Map.of("CMPSC     8", CourseInterest.ENTHUSIASTIC)))
        .noticeVersionId(40L)
        .build();
  }

  private static AuditTrail row(Long ta, Long ula, String field, String oldValue, String newValue) {
    return AuditTrail.builder()
        .taApplicationId(ta)
        .ulaApplicationId(ula)
        .fieldName(field)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  @Test
  public void nothing_changed_writes_nothing() {
    Application application = application();
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    List<AuditTrail> changes = service.record(before, application, RecruitmentType.TA);

    assertEquals(List.of(), changes);
    verify(auditTrailRepository, never()).saveAll(any());
  }

  /** Plain fields: one row each, values as strings, against the TA application id. */
  @Test
  public void changed_plain_fields_get_one_row_each_with_string_values() {
    Application application = application();
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    application.setMajor("Computer Engineering");
    application.setGpaMajor(3.7);
    application.setClassLevel(ClassLevel.MS);
    application.setMiddleName("M"); // was null
    application.setGpaOverall(null); // was null: no change
    List<AuditTrail> changes = service.record(before, application, RecruitmentType.TA);

    assertEquals(
        List.of(
            row(7L, null, "middleName", null, "M"),
            row(7L, null, "major", "Computer Science", "Computer Engineering"),
            row(7L, null, "gpaMajor", "3.9", "3.7"),
            row(7L, null, "classLevel", "PHD", "MS")),
        changes);
    verify(auditTrailRepository, times(1)).saveAll(changes);
  }

  /** A blanked field has a null new value, and a ULA application fills the other id column. */
  @Test
  public void a_blanked_field_has_a_null_new_value_and_a_ula_edit_uses_the_ula_id() {
    Application application = application();
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    application.setMajor(null);
    List<AuditTrail> changes = service.record(before, application, RecruitmentType.ULA);

    assertEquals(List.of(row(null, 7L, "major", "Computer Science", null)), changes);
  }

  /** The form sends "" for a field left empty, which is no change from null, and vice versa. */
  @Test
  public void a_blank_answer_and_no_answer_are_the_same() {
    Application application = application();
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    application.setMiddleName(""); // was null
    application.setComments("   "); // was null
    application.setMajor(""); // was "Computer Science": blanked
    List<AuditTrail> changes = service.record(before, application, RecruitmentType.TA);

    assertEquals(List.of(row(7L, null, "major", "Computer Science", null)), changes);
  }

  /**
   * Join-table rows are JSON of the whole row; a removed row has no new value, an added one no old.
   */
  @Test
  public void join_table_rows_are_recorded_as_json_rows_removed_then_added() {
    Application application = application();
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    // The form rebuilds the course rows: the one course is edited (so removed and added), and
    // a second is added. The ids the rebuilt rows get play no part.
    application.setPriorCoursework(
        new ArrayList<>(
            List.of(
                PriorCoursework.builder()
                    .id(31L)
                    .ucsbCourse(true)
                    .courseNumber("CMPSC 130A")
                    .courseTitle("Data Structures")
                    .term("F25")
                    .grade("A+")
                    .build(),
                PriorCoursework.builder()
                    .id(32L)
                    .ucsbCourse(false)
                    .otherSchool("De Anza College")
                    .courseNumber("CIS 22A")
                    .build())));
    application.getTopicProficiencies().put("Java", 5); // changed
    application.getTopicProficiencies().remove("C++"); // removed
    application.getInterests().put("Grading", 1); // added
    application.getCourseInterests().clear(); // removed
    List<AuditTrail> changes = service.record(before, application, RecruitmentType.TA);

    assertEquals(
        List.of(
            row(
                7L,
                null,
                "priorCoursework",
                "{\"ucsbCourse\":true,\"otherSchool\":null,\"courseNumber\":\"CMPSC 130A\","
                    + "\"courseTitle\":\"Data Structures\",\"term\":\"F25\",\"grade\":\"A\"}",
                null),
            row(
                7L,
                null,
                "priorCoursework",
                null,
                "{\"ucsbCourse\":true,\"otherSchool\":null,\"courseNumber\":\"CMPSC 130A\","
                    + "\"courseTitle\":\"Data Structures\",\"term\":\"F25\",\"grade\":\"A+\"}"),
            row(
                7L,
                null,
                "priorCoursework",
                null,
                "{\"ucsbCourse\":false,\"otherSchool\":\"De Anza College\","
                    + "\"courseNumber\":\"CIS 22A\",\"courseTitle\":null,\"term\":null,"
                    + "\"grade\":null}"),
            row(7L, null, "topicProficiencies", "{\"topic\":\"C++\",\"proficiency\":5}", null),
            row(7L, null, "topicProficiencies", "{\"topic\":\"Java\",\"proficiency\":4}", null),
            row(7L, null, "topicProficiencies", null, "{\"topic\":\"Java\",\"proficiency\":5}"),
            row(7L, null, "interests", null, "{\"interest\":\"Grading\",\"level\":1}"),
            row(
                7L,
                null,
                "courseInterests",
                "{\"courseId\":\"CMPSC     8\",\"interest\":\"ENTHUSIASTIC\"}",
                null)),
        changes);
  }

  /** Reordering rows is not a change, and null collections read as no rows. */
  @Test
  public void reordered_rows_are_not_a_change_and_null_collections_read_as_empty() {
    Application application = application();
    application.setPriorCoursework(
        new ArrayList<>(
            List.of(
                PriorCoursework.builder().ucsbCourse(true).courseNumber("A").build(),
                PriorCoursework.builder().ucsbCourse(true).courseNumber("B").build())));
    ApplicationAuditService.Snapshot before = service.snapshot(application);

    application.setPriorCoursework(
        new ArrayList<>(
            List.of(
                PriorCoursework.builder().ucsbCourse(true).courseNumber("B").build(),
                PriorCoursework.builder().ucsbCourse(true).courseNumber("A").build())));
    assertEquals(List.of(), service.record(before, application, RecruitmentType.TA));

    Application bare = Application.builder().id(8L).recruitmentId(1L).email("x@ucsb.edu").build();
    bare.setPriorCoursework(null);
    bare.setTopicProficiencies(null);
    bare.setInterests(null);
    bare.setCourseInterests(null);
    ApplicationAuditService.Snapshot bareBefore = service.snapshot(bare);
    assertEquals(0, bareBefore.rows().get("priorCoursework").size());
    assertEquals(0, bareBefore.rows().get("topicProficiencies").size());
    assertNull(bareBefore.fields().get("major"));
    assertEquals(List.of(), service.record(bareBefore, bare, RecruitmentType.ULA));
  }
}
