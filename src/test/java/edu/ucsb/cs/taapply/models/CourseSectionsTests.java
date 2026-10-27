package edu.ucsb.cs.taapply.models;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import edu.ucsb.cs.taapply.models.CourseSections.Meeting;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

public class CourseSectionsTests {

  private static UcsbTimeLocation at(
      String days, String begin, String end, String bldg, String room) {
    return UcsbTimeLocation.builder()
        .days(days)
        .beginTime(begin)
        .endTime(end)
        .building(bldg)
        .room(room)
        .build();
  }

  private static UcsbInstructor named(String name) {
    return UcsbInstructor.builder().instructor(name).build();
  }

  @Test
  public void none_has_no_title_and_no_meetings() {
    CourseSections none = CourseSections.none("CMPSC   156", "20241");

    assertEquals("CMPSC   156", none.courseId());
    assertEquals("20241", none.quarter());
    assertNull(none.title());
    assertEquals(List.of(), none.meetings());
  }

  /** Sections arrive in whatever order the API likes; the card lists them by number. */
  @Test
  public void meetings_are_in_section_order_with_lectures_flagged() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder()
            .courseId("CMPSC   156")
            .title("ADV APP PROGRAM")
            .classSections(
                List.of(
                    UcsbSection.builder()
                        .enrollCode("07500")
                        .section("0101")
                        .timeLocations(List.of(at("W", "09:00", "09:50", "PHELP", "1401")))
                        .instructors(List.of(named("GAUCHO C")))
                        .build(),
                    UcsbSection.builder()
                        .enrollCode("07492")
                        .section("0100")
                        .timeLocations(List.of(at("T R", "14:00", "15:15", "PHELP", "3526")))
                        .instructors(List.of(named("CONRAD P"), named("GAUCHO C")))
                        .build()))
            .build();

    CourseSections sections = CourseSections.from("CMPSC   156", "20241", offering);

    assertEquals("CMPSC   156", sections.courseId());
    assertEquals("20241", sections.quarter());
    assertEquals("ADV APP PROGRAM", sections.title());
    assertEquals(
        List.of(
            new Meeting(
                "0100", true, "07492", "T R", "14:00", "15:15", "PHELP 3526", "CONRAD P, GAUCHO C"),
            new Meeting("0101", false, "07500", "W", "09:00", "09:50", "PHELP 1401", "GAUCHO C")),
        sections.meetings());
  }

  /** A section meeting twice a week at different times is two rows, not one. */
  @Test
  public void a_section_with_two_meeting_times_is_two_rows() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder()
            .classSections(
                List.of(
                    UcsbSection.builder()
                        .enrollCode("07492")
                        .section("0100")
                        .timeLocations(
                            List.of(
                                at("M W", "14:00", "15:15", "PHELP", "3526"),
                                at("F", "14:00", "14:50", "GIRV", "1004")))
                        .instructors(List.of(named("CONRAD P")))
                        .build()))
            .build();

    assertEquals(
        List.of(
            new Meeting("0100", true, "07492", "M W", "14:00", "15:15", "PHELP 3526", "CONRAD P"),
            new Meeting("0100", true, "07492", "F", "14:00", "14:50", "GIRV 1004", "CONRAD P")),
        CourseSections.from("CMPSC   156", "20241", offering).meetings());
  }

  /** An online section has no time or place but is still a section the applicant could serve. */
  @Test
  public void a_section_with_no_meeting_time_is_one_row_with_blanks() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder()
            .classSections(
                List.of(
                    UcsbSection.builder()
                        .enrollCode("07500")
                        .section("0101")
                        .timeLocations(List.of())
                        .instructors(null)
                        .build(),
                    UcsbSection.builder()
                        .enrollCode("07501")
                        .section("0102")
                        .timeLocations(null)
                        .instructors(List.of())
                        .build()))
            .build();

    assertEquals(
        List.of(
            new Meeting("0101", false, "07500", null, null, null, null, ""),
            new Meeting("0102", false, "07501", null, null, null, null, "")),
        CourseSections.from("CMPSC   156", "20241", offering).meetings());
  }

  @Test
  public void an_offering_with_no_sections_has_no_meetings() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder().title("ADV APP PROGRAM").classSections(null).build();

    CourseSections sections = CourseSections.from("CMPSC   156", "20241", offering);
    assertEquals("ADV APP PROGRAM", sections.title());
    assertEquals(List.of(), sections.meetings());
  }

  /** The API sometimes has a building with no room, or a room with no building. */
  @Test
  public void location_copes_with_a_missing_building_or_room() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder()
            .classSections(
                List.of(
                    UcsbSection.builder()
                        .section("0100")
                        .timeLocations(
                            List.of(
                                at("M", "08:00", "08:50", "PHELP", null),
                                at("T", "08:00", "08:50", null, "1401"),
                                at("W", "08:00", "08:50", null, null)))
                        .instructors(List.of(named("CONRAD P"), named(null)))
                        .build()))
            .build();

    List<Meeting> meetings = CourseSections.from("CMPSC   156", "20241", offering).meetings();
    assertEquals(
        Arrays.asList("PHELP", "1401", ""), meetings.stream().map(Meeting::location).toList());
    // A nameless instructor entry is skipped rather than rendered as "null".
    assertEquals("CONRAD P", meetings.get(0).instructors());
  }

  /** A section with no number sorts first rather than crashing the comparison. */
  @Test
  public void a_section_without_a_number_sorts_first() {
    UcsbCourseOffering offering =
        UcsbCourseOffering.builder()
            .classSections(
                List.of(
                    UcsbSection.builder().section("0100").build(),
                    UcsbSection.builder().section(null).enrollCode("x").build()))
            .build();

    List<Meeting> meetings = CourseSections.from("CMPSC   156", "20241", offering).meetings();
    assertEquals("x", meetings.get(0).enrollCode());
    assertEquals("0100", meetings.get(1).section());
  }
}
