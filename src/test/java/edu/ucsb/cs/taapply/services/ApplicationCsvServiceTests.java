package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.opencsv.CSVReader;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import java.io.StringReader;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class ApplicationCsvServiceTests {

  private final ApplicationCsvService service = new ApplicationCsvService();

  private static final List<String> COMMON_BEFORE =
      List.of(
          "id",
          "submittedAt",
          "email",
          "status",
          "origin",
          "firstName",
          "middleName",
          "lastName",
          "major",
          "gpaMajor",
          "gpaOverall",
          "yearInProgram",
          "graduationDate");

  private static final List<String> CHOICES =
      List.of(
          "priorCoursework",
          "topicProficiencies",
          "prevExperience",
          "firstChoiceCourse",
          "secondChoiceCourse");

  /** Only the ULA form asks about availability (#76), so only a ULA file has these. */
  private static final List<String> AVAILABILITY =
      List.of(
          "availableForLecturesFirstChoice",
          "availableForDiscussionFirstChoice",
          "availabilityCommentsFirstChoice",
          "availableForLecturesSecondChoice",
          "availableForDiscussionSecondChoice",
          "availabilityCommentsSecondChoice");

  private static final List<String> COMMON_AFTER =
      List.of(
          "courseInterests",
          "comments",
          "postApplicationComments",
          "adminComments",
          "noticeVersionId",
          "cancellationReason",
          "cancelledAt");

  @SafeVarargs
  private static List<String> headers(List<String>... parts) {
    List<String> all = new ArrayList<>();
    for (List<String> part : parts) {
      all.addAll(part);
    }
    return all;
  }

  /** The document parsed back, so the assertions are about cells rather than quoting. */
  private static List<String[]> rows(String csv) throws Exception {
    try (CSVReader reader = new CSVReader(new StringReader(csv))) {
      return reader.readAll();
    }
  }

  /** Every answer set to something distinctive, so a dropped column would show. */
  private static Application full() {
    return Application.builder()
        .id(7L)
        .recruitmentId(1L)
        .email("ada@ucsb.edu")
        .status(ApplicationReviewStatus.PENDING)
        .origin(ApplicationOrigin.APPLICANT)
        .submittedAt(LocalDateTime.of(2026, 4, 1, 9, 30))
        .firstName("Ada")
        .middleName("M")
        .lastName("Lovelace")
        .major("Computer Science")
        .gpaMajor(3.9)
        .gpaOverall(3.8)
        .yearInProgram("2nd")
        .graduationDate("S27")
        .priorCoursework(
            new ArrayList<>(
                List.of(
                    PriorCoursework.builder()
                        .ucsbCourse(true)
                        .courseNumber("CMPSC 130A")
                        .courseTitle("Data Structures")
                        .term("F25")
                        .grade("A")
                        .build(),
                    PriorCoursework.builder()
                        .ucsbCourse(false)
                        .otherSchool("De Anza College")
                        .courseNumber("CIS 22A")
                        .courseTitle("Intro to C")
                        .term("Fall 2023")
                        .build())))
        .topicProficiencies(new HashMap<>(Map.of("Java", 4, "C++", 5)))
        .interests(new HashMap<>(Map.of("Tutoring", 5, "Grading", 1)))
        .prevExperience("TA for CS 24")
        .comments("Happy to help, \"either\" one")
        .postApplicationComments("Still keen")
        .adminComments("Interview Tuesday")
        .firstChoiceCourse("CMPSC   156")
        .secondChoiceCourse("CMPSC   130A")
        .availableForLecturesFirstChoice(true)
        .availableForLecturesSecondChoice(false)
        .availableForDiscussionFirstChoice(true)
        .availableForDiscussionSecondChoice(false)
        .availabilityCommentsFirstChoice("Free T R afternoons")
        .availabilityCommentsSecondChoice("Any section but Friday")
        .courseInterests(
            new HashMap<>(
                Map.of(
                    "CMPSC     8",
                    CourseInterest.ENTHUSIASTIC,
                    "CMPSC    16",
                    CourseInterest.WOULD_CONSIDER)))
        .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
        .languageExam(LanguageExamStatus.PASSED_F1_OR_J1_VISA)
        .languageExamDatePassed("F25")
        .classLevel(ClassLevel.PHD)
        .videoLink("https://example.org/video")
        .previousServiceAsUla(2)
        .permNumber("A1B2C3D")
        .bsMsStudent(true)
        .studentStatusNextQuarter(StudentStatus.UNDERGRADUATE)
        .wantsTaEligibility(true)
        .otherCampusJob(OtherCampusJob.NOT_SURE)
        .priorUcsbEmployment(true)
        .employeeId("1234567")
        .i9Appointment(false)
        .trainingCommitment(TrainingCommitment.AGREE)
        .trainingCommitmentExplanation(null)
        .changingMajor(false)
        .noticeVersionId(40L)
        .build();
  }

  private static final List<String> ULA_ONLY =
      List.of(
          "previousServiceAsUla",
          "videoLink",
          "permNumber",
          "bsMsStudent",
          "studentStatusNextQuarter",
          "wantsTaEligibility",
          "otherCampusJob",
          "priorUcsbEmployment",
          "employeeId",
          "i9Appointment",
          "trainingCommitment",
          "trainingCommitmentExplanation",
          "changingMajor");

  @Test
  public void a_ta_file_has_the_ta_columns_in_order_and_one_row_per_application() throws Exception {
    List<String[]> rows = rows(service.write(RecruitmentType.TA, List.of(full())));

    assertEquals(2, rows.size());
    assertEquals(
        headers(
            COMMON_BEFORE,
            List.of("classLevel", "residencyStatus", "languageExam", "languageExamDatePassed"),
            CHOICES,
            COMMON_AFTER),
        List.of(rows.get(0)));
    assertEquals(
        List.of(
            "7",
            "2026-04-01T09:30",
            "ada@ucsb.edu",
            "PENDING",
            "APPLICANT",
            "Ada",
            "M",
            "Lovelace",
            "Computer Science",
            "3.9",
            "3.8",
            "2nd",
            "S27",
            "PHD",
            "F1_STUDENT_VISA",
            "PASSED_F1_OR_J1_VISA",
            "F25",
            // Course fields separated by commas, courses by semicolons; a blank grade stays blank.
            "UCSB,CMPSC 130A,Data Structures,F25,A;De Anza College,CIS 22A,Intro to C,Fall 2023,",
            // name:value pairs, in name order.
            "C++:5,Java:4",
            "TA for CS 24",
            "CMPSC   156",
            "CMPSC   130A",
            "CMPSC     8:ENTHUSIASTIC,CMPSC    16:WOULD_CONSIDER",
            "Happy to help, \"either\" one",
            "Still keen",
            "Interview Tuesday",
            "40",
            // Not cancelled: both cancellation columns blank (issue #107).
            "",
            ""),
        List.of(rows.get(1)));
  }

  /** The ULA file swaps the TA-only columns for the ULA ones, and adds the interests at the end. */
  @Test
  public void a_ula_file_has_the_ula_columns_and_the_interests() throws Exception {
    List<String[]> rows = rows(service.write(RecruitmentType.ULA, List.of(full())));

    List<String> expectedHeaders =
        headers(COMMON_BEFORE, ULA_ONLY, CHOICES, AVAILABILITY, COMMON_AFTER);
    expectedHeaders = new ArrayList<>(expectedHeaders);
    expectedHeaders.add("interests");
    assertEquals(expectedHeaders, List.of(rows.get(0)));

    String[] row = rows.get(1);
    assertEquals("2", row[13]);
    assertEquals("https://example.org/video", row[14]);
    // The Google Form's questions, in the order the form asked them
    assertEquals(
        List.of(
            "A1B2C3D",
            "true",
            "UNDERGRADUATE",
            "true",
            "NOT_SURE",
            "true",
            "1234567",
            "false",
            "AGREE",
            "",
            "false"),
        List.of(row).subList(15, 26));
    assertEquals("Grading:1,Tutoring:5", row[row.length - 1]);
    // And none of the TA-only answers leak in.
    assertEquals(-1, List.of(rows.get(0)).indexOf("classLevel"));
    assertEquals(-1, String.join("|", row).indexOf("F1_STUDENT_VISA"));
    assertEquals(-1, String.join("|", row).indexOf("PASSED_F1_OR_J1_VISA"));
  }

  /** Every cell is quoted, so commas and semicolons inside an answer survive a round trip. */
  @Test
  public void cells_are_quoted() {
    String csv = service.write(RecruitmentType.TA, List.of(full()));

    assertEquals("\"id\",\"submittedAt\"", csv.substring(0, "\"id\",\"submittedAt\"".length()));
    assertEquals(true, csv.contains("\"C++:5,Java:4\""));
    assertEquals(true, csv.contains("\"\"either\"\""));
  }

  @Test
  public void no_applications_is_just_the_header_row() throws Exception {
    List<String[]> rows = rows(service.write(RecruitmentType.ULA, List.of()));

    assertEquals(1, rows.size());
    assertEquals("id", rows.get(0)[0]);
  }

  /** Unanswered questions are empty cells, never the word null, and empty lists are empty cells. */
  @Test
  public void unanswered_questions_are_empty_cells() throws Exception {
    Application bare = Application.builder().id(3L).recruitmentId(1L).email("x@ucsb.edu").build();
    bare.setPriorCoursework(null);
    bare.setTopicProficiencies(null);
    bare.setCourseInterests(null);
    bare.setInterests(null);

    List<String[]> rows = rows(service.write(RecruitmentType.ULA, List.of(bare)));
    String[] headers = rows.get(0);
    String[] row = rows.get(1);

    assertEquals("3", row[0]);
    assertEquals("", row[1]); // submittedAt
    assertEquals("x@ucsb.edu", row[2]);
    assertEquals("PENDING", row[3]); // the builder default
    assertEquals("APPLICANT", row[4]); // the builder default origin
    // The four availability answers are primitive booleans, so they read false rather than blank.
    List<String> primitiveBooleans =
        List.of(
            "availableForLecturesFirstChoice",
            "availableForDiscussionFirstChoice",
            "availableForLecturesSecondChoice",
            "availableForDiscussionSecondChoice");
    for (int i = 5; i < row.length; i++) {
      if (primitiveBooleans.contains(headers[i])) {
        assertEquals("false", row[i], "column " + headers[i]);
      } else {
        assertEquals("", row[i], "column " + headers[i]);
      }
    }
    assertEquals(-1, String.join("|", row).indexOf("null"));
  }

  @Test
  public void the_helpers_handle_empty_and_null_collections() {
    assertEquals("", ApplicationCsvService.courses(null));
    assertEquals("", ApplicationCsvService.courses(List.of()));
    assertEquals("", ApplicationCsvService.pairs(null));
    assertEquals("", ApplicationCsvService.pairs(Map.of()));
    assertEquals("", ApplicationCsvService.text(null));
    assertEquals("5", ApplicationCsvService.text(5));
    assertEquals(
        "UCSB,CMPSC 8,,,",
        ApplicationCsvService.courses(
            List.of(PriorCoursework.builder().ucsbCourse(true).courseNumber("CMPSC 8").build())));
    assertEquals(
        ",CS 31,,,",
        ApplicationCsvService.courses(
            List.of(PriorCoursework.builder().ucsbCourse(false).courseNumber("CS 31").build())));
  }

  /** The availability columns are a ULA file's, between the choices and the course interests. */
  @Test
  public void a_ta_file_has_no_availability_columns_and_a_ula_file_has_them_filled()
      throws Exception {
    List<String> taHeaders =
        List.of(rows(service.write(RecruitmentType.TA, List.of(full()))).get(0));
    for (String column : AVAILABILITY) {
      assertEquals(-1, taHeaders.indexOf(column), column);
    }
    assertEquals(taHeaders.indexOf("secondChoiceCourse") + 1, taHeaders.indexOf("courseInterests"));

    List<String[]> ula = rows(service.write(RecruitmentType.ULA, List.of(full())));
    List<String> ulaHeaders = List.of(ula.get(0));
    int first = ulaHeaders.indexOf("availableForLecturesFirstChoice");
    assertEquals(ulaHeaders.indexOf("secondChoiceCourse") + 1, first);
    assertEquals(
        List.of("true", "true", "Free T R afternoons", "false", "false", "Any section but Friday"),
        List.of(ula.get(1)).subList(first, first + 6));
  }
}
