package edu.ucsb.cs.taapply.models;

import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import java.time.LocalDateTime;
import java.util.List;

/**
 * One soft offer as its applicant sees it (issue #486): the recruitment it belongs to, the lecture
 * they have been assigned to with its instructor and times, the lecture's sections (null when the
 * UCSB API could not be reached), the Soft Offer Notices text (null when none is saved), the
 * deadline, and their answer so far (null until they answer for this lecture).
 *
 * <p>This is the one applicant-facing place a tentative assignment is revealed, and only while the
 * recruitment's soft offers are released; {@code Application}'s own JSON still never carries it.
 */
public record SoftOfferDto(
    Long recruitmentId,
    String quarter,
    Long applicationId,
    LocalDateTime releasedAt,
    LocalDateTime deadline,
    Notice notice,
    Course course,
    List<Meeting> sections,
    Response response) {

  /** The newest Soft Offer Notices version. */
  public record Notice(Long id, String content) {}

  /** The lecture: "CMPSC 8" style number, section, title, instructor and meeting time. */
  public record Course(
      Long recruitmentCourseId,
      String courseNumber,
      String section,
      String title,
      String instructor,
      String instructorEmail,
      String days,
      String beginTime,
      String endTime) {}

  /** One meeting of one discussion section of the lecture; a section with no time has nulls. */
  public record Meeting(String section, String days, String beginTime, String endTime) {}

  /** The applicant's answer for this lecture. */
  public record Response(SoftOfferDecision decision, String comments, LocalDateTime respondedAt) {}
}
