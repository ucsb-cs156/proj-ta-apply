package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The JSON columns of a draft application (issue #270), apart from any database. */
class JsonColumnConverterTests {

  private final DraftApplication.LevelsConverter levels = new DraftApplication.LevelsConverter();
  private final DraftApplication.CourseInterestsConverter courseInterests =
      new DraftApplication.CourseInterestsConverter();
  private final DraftApplication.PriorCourseworkConverter coursework =
      new DraftApplication.PriorCourseworkConverter();

  @Test
  void a_map_is_written_as_json_and_read_back() {
    String json = levels.convertToDatabaseColumn(Map.of("Java", 4));

    assertEquals("{\"Java\":4}", json);
    assertEquals(Map.of("Java", 4), levels.convertToEntityAttribute(json));
  }

  @Test
  void course_interests_keep_their_enum_values() {
    String json =
        courseInterests.convertToDatabaseColumn(Map.of("CMPSC 8", CourseInterest.ENTHUSIASTIC));

    assertEquals("{\"CMPSC 8\":\"ENTHUSIASTIC\"}", json);
    assertEquals(
        Map.of("CMPSC 8", CourseInterest.ENTHUSIASTIC),
        courseInterests.convertToEntityAttribute(json));
  }

  @Test
  void coursework_rows_round_trip_without_ids() {
    List<PriorCoursework> rows =
        List.of(
            PriorCoursework.builder()
                .ucsbCourse(false)
                .otherSchool("De Anza")
                .courseNumber("CIS 22A")
                .courseTitle("Intro to C")
                .term("F23")
                .grade("A")
                .build());

    List<PriorCoursework> back =
        coursework.convertToEntityAttribute(coursework.convertToDatabaseColumn(rows));

    assertEquals(rows, back);
  }

  @Test
  void null_is_stored_as_null() {
    assertNull(levels.convertToDatabaseColumn(null));
    assertNull(coursework.convertToDatabaseColumn(null));
  }

  @Test
  void nothing_stored_reads_as_an_empty_collection_that_can_be_changed() {
    for (String nothing : new String[] {null, "", "   "}) {
      Map<String, Integer> map = levels.convertToEntityAttribute(nothing);
      assertNotNull(map);
      assertTrue(map.isEmpty());
      map.put("Java", 1);
      List<PriorCoursework> list = coursework.convertToEntityAttribute(nothing);
      assertNotNull(list);
      assertTrue(list.isEmpty());
      list.add(PriorCoursework.builder().build());
      assertTrue(courseInterests.convertToEntityAttribute(nothing).isEmpty());
    }
  }

  @Test
  void unreadable_json_is_an_error_not_an_empty_collection() {
    IllegalStateException e =
        assertThrows(IllegalStateException.class, () -> levels.convertToEntityAttribute("{oops"));
    assertEquals("Could not read the collection from JSON", e.getMessage());
  }

  /** A value Jackson cannot write, to reach the writing failure. */
  private static class Unwritable extends JsonColumnConverter<Object> {
    Unwritable() {
      super(new TypeReference<>() {}, HashMap::new);
    }
  }

  @Test
  void a_value_that_cannot_be_written_is_an_error() {
    Object selfReferencing =
        new Object() {
          public Object getSelf() {
            return this;
          }
        };

    IllegalStateException e =
        assertThrows(
            IllegalStateException.class,
            () -> new Unwritable().convertToDatabaseColumn(selfReferencing));
    assertEquals("Could not write the collection as JSON", e.getMessage());
  }
}
