package edu.ucsb.cs.taapply.models;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * When and where one course's lectures and sections meet in one quarter, as shown to an applicant
 * who has just chosen that course. Built from the UCSB API's view of the course, narrowed to what
 * helps someone decide whether they are free at those times.
 *
 * @param courseId the padded course id the applicant chose
 * @param quarter the recruitment's quarter, YYYYQ
 * @param title the course title, or null if the API had nothing for this course
 * @param meetings one row per meeting time, in section order; empty if nothing is known
 */
public record CourseSections(
    String courseId, String quarter, String title, List<Meeting> meetings) {

  /**
   * One meeting of one section. A section that meets at two times (say a lecture on M W and again
   * on F) is two rows, and a section with no scheduled time (an online class) is one row with no
   * days, time or location, so it is still listed.
   */
  public record Meeting(
      String section,
      boolean lecture,
      String enrollCode,
      String days,
      String beginTime,
      String endTime,
      String location,
      String instructors) {}

  /** What to show when the recruitment has no section of this course to look up. */
  public static CourseSections none(String courseId, String quarter) {
    return new CourseSections(courseId, quarter, null, List.of());
  }

  public static CourseSections from(String courseId, String quarter, UcsbCourseOffering offering) {
    List<Meeting> meetings = new ArrayList<>();
    List<UcsbSection> sections =
        offering.getClassSections() == null ? List.of() : offering.getClassSections();
    sections.stream()
        .sorted(
            Comparator.comparing(
                UcsbSection::getSection, Comparator.nullsFirst(Comparator.naturalOrder())))
        .forEach(section -> meetings.addAll(meetingsOf(section)));
    return new CourseSections(courseId, quarter, offering.getTitle(), meetings);
  }

  private static List<Meeting> meetingsOf(UcsbSection section) {
    String instructors = instructorsOf(section);
    List<UcsbTimeLocation> locations = section.getTimeLocations();
    if (locations == null || locations.isEmpty()) {
      return List.of(
          new Meeting(
              section.getSection(),
              section.isPrimary(),
              section.getEnrollCode(),
              null,
              null,
              null,
              null,
              instructors));
    }
    return locations.stream()
        .map(
            location ->
                new Meeting(
                    section.getSection(),
                    section.isPrimary(),
                    section.getEnrollCode(),
                    location.getDays(),
                    location.getBeginTime(),
                    location.getEndTime(),
                    locationOf(location),
                    instructors))
        .toList();
  }

  /** Building and room together, as on the job's recruitment course rows. */
  private static String locationOf(UcsbTimeLocation location) {
    String building = location.getBuilding() == null ? "" : location.getBuilding();
    String room = location.getRoom() == null ? "" : location.getRoom();
    return (building + " " + room).trim();
  }

  /** Every instructor of record, comma separated; blank rather than null when none is listed. */
  private static String instructorsOf(UcsbSection section) {
    if (section.getInstructors() == null) {
      return "";
    }
    return String.join(
        ", ",
        section.getInstructors().stream()
            .map(UcsbInstructor::getInstructor)
            .filter(name -> name != null)
            .toList());
  }
}
