package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.services.LegacyUlaApplicationCsvService.Columns;
import edu.ucsb.cs.taapply.services.LegacyUlaApplicationCsvService.ImportResult;
import edu.ucsb.cs.taapply.services.LegacyUlaApplicationCsvService.Row;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(classes = LegacyUlaApplicationCsvService.class)
@ActiveProfiles("test")
public class LegacyUlaApplicationCsvServiceTests {

  @Autowired LegacyUlaApplicationCsvService service;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UlaMajorRepository ulaMajorRepository;
  @MockitoBean UlaTopicRepository ulaTopicRepository;
  @MockitoBean UlaInterestRepository ulaInterestRepository;

  /** The committed, obfuscated response sheet: the real format with no real data in it. */
  private static final Path SAMPLE = Path.of("docs/sample-data/legacy-ula-csv-example.csv");

  private static final Recruitment ULA =
      Recruitment.builder().id(6L).quarter("20264").type(RecruitmentType.ULA).build();

  /** The sheet's header with the condensed names the obfuscation script writes. */
  private static final String HEADER =
      "Timestamp,Email Address,First name,Last name,Perm number,Expected graduation date,"
          + "BS/MS student?,Will you be in undergrad or graduate student status for the coming"
          + " quarter (F26)?,Do you want to be eligible for TA positions after you transition to"
          + " graduate status?,Other Campus Job?,Prior UCSB employment?,Employee ID number,"
          + "Previous LA Service for CS,Agree to statement,If you indicated that you are UNSURE or"
          + " that you CANNOT commit to this training\\, please explain.,"
          + "Course Preferences [5A  (Kharitonova Y)],Course Preferences [8   (Kharitonova Y)],"
          + "Course Preferences [156   (Conrad P T)],Course Preferences [190A  (Bu Y)],"
          + "First Choice,Second Choice,Lectures: first choice,Lectures: second choice,"
          + "Sections: first choice,Sections: second choice,Availability Comments,GPA,Major,"
          + "Changing major?,Rate your familiarity with each of these platforms [CSIL computing"
          + " environment],Rate your familiarity with each of these platforms [Git/GitHub],"
          + "Rate your familiarity with these languages/systems [C++],"
          + "Rate your familiarity with probability and stats needed for data science courses"
          + " (only if applying to be an LA for Data Science courses (5A/5B) [Regression],"
          + "Activity Interests [Assisting students one on one on programming assignments],"
          + "Activity Interests [Exploring teaching as a career option],Video Link\n";

  private static final String ROW =
      "5/9/2026 13:45:12,Ada.Lovelace@umail.ucsb.edu,Ada,Lovelace,a1b2c3d,S27,Yes,Graduate,"
          + "\"Yes: so I will DEFINITELY enroll in the TA training courses in Fall, which are"
          + " offered ONLY IN FALL.\",Not sure yet,Yes,1234567,0,"
          + "I am UNSURE if I can commit to this training at this point.,Might have a Friday lab,"
          + "2-Would Consider,1-Enthusiastic,1-Enthusiastic,3-Not Applicable,156   (Conrad P T),"
          + "24   (Mirza D),Only one per week,Both lectures per week,Yes,No,"
          + "No conflicts I know of.,3.8,CMPSC (Computer Science),No,1-Very comfortable,"
          + "2-Somewhat comfortable,3-Not familiar,1-Very comfortable,5-Very interested,2,"
          + "https://youtu.be/dQw4w9WgXcQ\n";

  private static MockMultipartFile csv(String content) {
    return new MockMultipartFile(
        "file", "responses.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8));
  }

  private static RecruitmentCourse course(String courseId, boolean removed) {
    return RecruitmentCourse.builder()
        .recruitmentId(6L)
        .courseId(courseId)
        .enrollCode(courseId)
        .removed(removed)
        .build();
  }

  private void defaultLists() {
    when(recruitmentCourseRepository.findByRecruitmentId(6L))
        .thenReturn(
            List.of(
                course("CMPSC     8", false),
                course("CMPSC    5A", false),
                course("CMPSC   156", false),
                course("CMPSC    24", true)));
    when(ulaMajorRepository.findAll())
        .thenReturn(
            List.of(
                UlaMajor.builder().name("Computer Science").build(),
                UlaMajor.builder().name("Computer Engineering").build()));
    when(ulaTopicRepository.findAll())
        .thenReturn(
            List.of(
                UlaTopic.builder().name("CSIL").build(),
                UlaTopic.builder().name("Git / GitHub").build()));
    when(ulaInterestRepository.findAll())
        .thenReturn(
            List.of(
                UlaInterest.builder()
                    .name("Assisting students one on one on programming assignments")
                    .build()));
  }

  // ---- the upload as a whole ----

  @Test
  public void the_sample_sheet_imports_whole_with_one_application_per_row() throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId(any(), any())).thenReturn(false);
    MockMultipartFile file =
        new MockMultipartFile("file", "responses.csv", "text/csv", Files.readAllBytes(SAMPLE));

    ImportResult result = service.upload(file, ULA);

    assertEquals(82, result.inserted());
    assertEquals(0, result.alreadyPresent());
    assertEquals(0, result.skipped());
    assertEquals(List.of(), result.problems());
    // The sheet's sixteen familiarity topics, less the two the list already had (by name).
    assertEquals(
        List.of(
            "C++",
            "Classification",
            "Clustering",
            "Interpreting correlation coefficients",
            "Java",
            "JavaScript",
            "Jupyter Notebooks",
            "MacOS",
            "Python",
            "React",
            "Regression",
            "Unix/Linux command line in general",
            "VSCode",
            "Windows"),
        result.addedTopics().stream().sorted().toList());
    assertEquals(
        List.of(
            "Exploring teaching as a career option",
            "Learning about current research in CS Education",
            "Providing written feedback to students about their work"),
        result.addedInterests().stream().sorted().toList());
    verify(ulaTopicRepository, times(14)).save(any());
    verify(ulaInterestRepository, times(3)).save(any());

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(82)).save(saved.capture());
    for (Application a : saved.getAllValues()) {
      assertEquals(6L, a.getRecruitmentId());
      assertEquals(ApplicationReviewStatus.PENDING, a.getStatus());
      assertEquals(ApplicationOrigin.APPLICANT, a.getOrigin());
      assertNull(a.getNoticeVersionId());
      assertTrue(a.getEmail().contains("@"));
      assertEquals(7, a.getPermNumber().length());
      assertTrue(
          a.getAdminComments().startsWith("Imported from the ULA application form; submitted "));
    }
  }

  @Test
  public void a_new_row_is_mapped_and_saved() throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId(any(), any())).thenReturn(false);

    ImportResult result = service.upload(csv(HEADER + ROW), ULA);

    // C++ and Regression are rated but not on the topics list; one activity is not on the list.
    assertEquals(
        new ImportResult(
            1,
            0,
            0,
            List.of(),
            List.of("C++", "Regression"),
            List.of("Exploring teaching as a career option")),
        result);
    verify(ulaTopicRepository, times(1)).save(UlaTopic.builder().name("C++").build());
    verify(ulaInterestRepository, times(1))
        .save(UlaInterest.builder().name("Exploring teaching as a career option").build());

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(saved.capture());
    Application a = saved.getValue();
    assertEquals("ada.lovelace@ucsb.edu", a.getEmail());
    assertEquals("Ada", a.getFirstName());
    assertEquals("Lovelace", a.getLastName());
    assertEquals("A1B2C3D", a.getPermNumber());
    assertEquals("S27", a.getGraduationDate());
    assertEquals(true, a.getBsMsStudent());
    assertEquals(StudentStatus.GRADUATE, a.getStudentStatusNextQuarter());
    assertEquals(true, a.getWantsTaEligibility());
    assertEquals(OtherCampusJob.NOT_SURE, a.getOtherCampusJob());
    assertEquals(true, a.getPriorUcsbEmployment());
    assertEquals("1234567", a.getEmployeeId());
    assertEquals(0, a.getPreviousServiceAsUla());
    assertEquals(TrainingCommitment.UNSURE, a.getTrainingCommitment());
    assertEquals("Might have a Friday lab", a.getTrainingCommitmentExplanation());
    // 156 is listed, 24 is removed from the recruitment: the second choice is noted instead.
    assertEquals("CMPSC   156", a.getFirstChoiceCourse());
    assertNull(a.getSecondChoiceCourse());
    // 5A would consider, 8 enthusiastic, 156 is the first choice so not here, 190A not applicable.
    assertEquals(
        Map.of(
            "CMPSC    5A",
            CourseInterest.WOULD_CONSIDER,
            "CMPSC     8",
            CourseInterest.ENTHUSIASTIC),
        a.getCourseInterests());
    assertTrue(a.isAvailableForLecturesFirstChoice());
    assertTrue(a.isAvailableForLecturesSecondChoice());
    assertTrue(a.isAvailableForDiscussionFirstChoice());
    assertFalse(a.isAvailableForDiscussionSecondChoice());
    assertEquals(
        "No conflicts I know of.\nLectures: can attend only one per week.",
        a.getAvailabilityCommentsFirstChoice());
    assertNull(a.getAvailabilityCommentsSecondChoice());
    assertEquals(3.8, a.getGpaOverall());
    assertNull(a.getGpaMajor());
    assertEquals("Computer Science", a.getMajor());
    assertEquals(false, a.getChangingMajor());
    assertEquals(
        Map.of("CSIL", 1, "Git / GitHub", 2, "C++", 3, "Regression", 1), a.getTopicProficiencies());
    assertEquals(
        Map.of(
            "Assisting students one on one on programming assignments", 5,
            "Exploring teaching as a career option", 2),
        a.getInterests());
    assertEquals("https://youtu.be/dQw4w9WgXcQ", a.getVideoLink());
    assertEquals(
        "Second choice on the form: CMPSC 24 (not offered in this recruitment)", a.getComments());
    assertEquals(
        "Imported from the ULA application form; submitted 5/9/2026 13:45:12.",
        a.getAdminComments());
    assertNull(a.getI9Appointment());
    assertNull(a.getYearInProgram());
    assertTrue(a.getPriorCoursework().isEmpty());
  }

  @Test
  public void a_row_already_imported_is_counted_and_a_row_without_an_email_is_reported()
      throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId("ada.lovelace@ucsb.edu", 6L))
        .thenReturn(true);
    String noEmail = ROW.replace("Ada.Lovelace@umail.ucsb.edu", "not an address");
    String blankRow = ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n";

    ImportResult result = service.upload(csv(HEADER + ROW + noEmail + blankRow + ROW), ULA);

    assertEquals(
        new ImportResult(0, 2, 1, List.of("row 3: no usable email address"), List.of(), List.of()),
        result);
    verify(applicationRepository, never()).save(any());
    verify(ulaTopicRepository, never()).save(any());
    verify(ulaInterestRepository, never()).save(any());
  }

  @Test
  public void only_a_ula_recruitment_a_non_empty_file_and_the_required_columns_are_accepted() {
    Recruitment ta = Recruitment.builder().id(5L).type(RecruitmentType.TA).build();
    ResponseStatusException e =
        assertThrows(ResponseStatusException.class, () -> service.upload(csv(HEADER + ROW), ta));
    assertEquals(400, e.getStatusCode().value());
    assertEquals(
        "The ULA form's responses can only be imported into a ULA recruitment", e.getReason());

    defaultLists();
    e = assertThrows(ResponseStatusException.class, () -> service.upload(csv(""), ULA));
    assertEquals("CSV file is empty", e.getReason());

    e =
        assertThrows(
            ResponseStatusException.class,
            () -> service.upload(csv("Email Address,First name\nx@ucsb.edu,X\n"), ULA));
    assertEquals("CSV file is missing the column(s) [Last name]", e.getReason());
    verify(applicationRepository, never()).save(any());
  }

  // ---- the header ----

  /** Both the condensed headers the script writes and the form's original long ones match. */
  @Test
  public void headers_match_by_their_start_in_either_wording_and_a_bom_is_ignored() {
    Columns condensed =
        new Columns(
            new String[] {
              "﻿Timestamp",
              "Email Address",
              "First name",
              "Last name",
              "Lectures: first choice",
              "Lectures: second choice",
              "Sections: first choice",
              "Sections: second choice",
              "Agree to statement"
            });
    assertEquals(0, condensed.find(LegacyUlaApplicationCsvService.TIMESTAMP));
    assertEquals(4, condensed.find(LegacyUlaApplicationCsvService.LECTURES_FIRST));
    assertEquals(5, condensed.find(LegacyUlaApplicationCsvService.LECTURES_SECOND));
    assertEquals(6, condensed.find(LegacyUlaApplicationCsvService.SECTIONS_FIRST));
    assertEquals(7, condensed.find(LegacyUlaApplicationCsvService.SECTIONS_SECOND));
    assertEquals(8, condensed.find(LegacyUlaApplicationCsvService.TRAINING));
    assertEquals(-1, condensed.find(LegacyUlaApplicationCsvService.VIDEO));

    Columns original =
        new Columns(
            new String[] {
              "Email Address",
              "First name",
              "Last name",
              "Are you available to attend the lectures for your first and second choice courses?"
                  + "\n(Note) [First choice course]",
              "Are you available to attend the lectures for your first and second choice courses?"
                  + "\n(Note) [Second choice course]",
              "Are you available to attend at least one of the lab/discussion sections?"
                  + "\n(Note) [First choice course]",
              "Are you available to attend at least one of the lab/discussion sections?"
                  + "\n(Note) [Second choice course]",
              "IMPORTANT: Please READ THE FOLLOWING STATEMENT and then CHECK the button.\n\nIf I am"
            });
    assertEquals(3, original.find(LegacyUlaApplicationCsvService.LECTURES_FIRST));
    assertEquals(4, original.find(LegacyUlaApplicationCsvService.LECTURES_SECOND));
    assertEquals(5, original.find(LegacyUlaApplicationCsvService.SECTIONS_FIRST));
    assertEquals(6, original.find(LegacyUlaApplicationCsvService.SECTIONS_SECOND));
    assertEquals(7, original.find(LegacyUlaApplicationCsvService.TRAINING));
    assertEquals(
        Map.of(
            3,
            "First choice course",
            4,
            "Second choice course",
            5,
            "First choice course",
            6,
            "Second choice course"),
        original.labels);

    Row shortRow = new Row(condensed, new String[] {"5/9/2026 1:02:03", " a@ucsb.edu "});
    assertEquals("a@ucsb.edu", shortRow.get(LegacyUlaApplicationCsvService.EMAIL));
    assertEquals("", shortRow.get(LegacyUlaApplicationCsvService.LAST_NAME));
    assertEquals("", shortRow.get(LegacyUlaApplicationCsvService.VIDEO));
    assertFalse(shortRow.isBlank());
    assertTrue(new Row(condensed, new String[] {"", "  "}).isBlank());
    assertEquals(List.of(4, 5), condensed.all("Lectures:"));
  }

  // ---- field by field ----

  @Test
  public void yes_no_and_the_other_choice_answers_are_matched_by_their_words() {
    assertEquals(true, LegacyUlaApplicationCsvService.yesNo("Yes"));
    assertEquals(false, LegacyUlaApplicationCsvService.yesNo("no"));
    assertNull(LegacyUlaApplicationCsvService.yesNo(""));
    assertNull(LegacyUlaApplicationCsvService.yesNo("Maybe"));

    assertEquals(
        StudentStatus.UNDERGRADUATE, LegacyUlaApplicationCsvService.studentStatus("Undergraduate"));
    assertEquals(StudentStatus.GRADUATE, LegacyUlaApplicationCsvService.studentStatus("Graduate"));
    assertNull(LegacyUlaApplicationCsvService.studentStatus(""));

    assertEquals(
        true,
        LegacyUlaApplicationCsvService.taEligibility(
            "Yes: so I will DEFINITELY enroll in the TA training courses in Fall"));
    assertEquals(false, LegacyUlaApplicationCsvService.taEligibility("No"));
    assertNull(LegacyUlaApplicationCsvService.taEligibility("Yes, but I am graduating in S28"));
    assertNull(LegacyUlaApplicationCsvService.taEligibility(""));

    assertEquals(OtherCampusJob.YES, LegacyUlaApplicationCsvService.otherCampusJob("Yes"));
    assertEquals(OtherCampusJob.NO, LegacyUlaApplicationCsvService.otherCampusJob("No"));
    assertEquals(
        OtherCampusJob.NOT_SURE, LegacyUlaApplicationCsvService.otherCampusJob("Not sure yet"));
    assertNull(LegacyUlaApplicationCsvService.otherCampusJob("Nothing"));
    assertNull(LegacyUlaApplicationCsvService.otherCampusJob(""));

    assertEquals("1234567", LegacyUlaApplicationCsvService.employeeId(" 1234567 "));
    assertNull(LegacyUlaApplicationCsvService.employeeId("I don't remember it"));
    assertNull(LegacyUlaApplicationCsvService.employeeId(""));

    assertEquals(0, LegacyUlaApplicationCsvService.previousService("0"));
    assertEquals(6, LegacyUlaApplicationCsvService.previousService("6"));
    assertEquals(7, LegacyUlaApplicationCsvService.previousService("More than 6"));
    assertNull(LegacyUlaApplicationCsvService.previousService("many"));
    assertNull(LegacyUlaApplicationCsvService.previousService(""));

    assertEquals(
        TrainingCommitment.AGREE,
        LegacyUlaApplicationCsvService.trainingCommitment("I AGREE to this commitment."));
    assertEquals(
        TrainingCommitment.UNSURE,
        LegacyUlaApplicationCsvService.trainingCommitment("I am UNSURE if I can commit"));
    assertEquals(
        TrainingCommitment.CANNOT,
        LegacyUlaApplicationCsvService.trainingCommitment("I CANNOT commit to this training"));
    assertNull(LegacyUlaApplicationCsvService.trainingCommitment(""));

    assertEquals(
        CourseInterest.ENTHUSIASTIC,
        LegacyUlaApplicationCsvService.courseInterest("1-Enthusiastic"));
    assertEquals(
        CourseInterest.WOULD_CONSIDER,
        LegacyUlaApplicationCsvService.courseInterest("2-Would Consider"));
    assertNull(LegacyUlaApplicationCsvService.courseInterest("3-Not Applicable"));
    assertNull(LegacyUlaApplicationCsvService.courseInterest(""));

    assertTrue(LegacyUlaApplicationCsvService.lectures("Both lectures per week"));
    assertTrue(LegacyUlaApplicationCsvService.lectures("Only one per week"));
    assertFalse(LegacyUlaApplicationCsvService.lectures("None of the lectures"));
    assertFalse(LegacyUlaApplicationCsvService.lectures(""));
  }

  @Test
  public void the_availability_comment_notes_a_single_lecture_a_week() {
    assertNull(LegacyUlaApplicationCsvService.availability(null, "Both lectures per week"));
    assertNull(LegacyUlaApplicationCsvService.availability("  ", ""));
    assertEquals(
        "Lectures: can attend only one per week.",
        LegacyUlaApplicationCsvService.availability(null, "Only one per week"));
    assertEquals(
        "Fridays are hard.",
        LegacyUlaApplicationCsvService.availability(" Fridays are hard. ", "None"));
    assertEquals(
        "Fridays are hard.\nLectures: can attend only one per week.",
        LegacyUlaApplicationCsvService.availability("Fridays are hard.", "Only one per week"));
  }

  @Test
  public void courses_are_matched_to_the_recruitment_by_number() {
    Set<String> courseIds = new TreeSet<>(List.of("CMPSC     8", "CMPSC   130A", "CMPSC   156"));
    assertEquals("24", LegacyUlaApplicationCsvService.leadingNumber("24   (Mirza D)"));
    assertEquals("130A", LegacyUlaApplicationCsvService.leadingNumber("130a  (Lokshtanov D)"));
    assertEquals("5A", LegacyUlaApplicationCsvService.leadingNumber("5A  (Kharitonova Y)"));
    assertNull(LegacyUlaApplicationCsvService.leadingNumber(""));
    assertNull(LegacyUlaApplicationCsvService.leadingNumber("Tbd"));
    assertEquals("CMPSC   130A", LegacyUlaApplicationCsvService.courseByNumber("130A", courseIds));
    assertNull(LegacyUlaApplicationCsvService.courseByNumber("24", courseIds));

    List<String> notes = new ArrayList<>();
    assertEquals(
        "CMPSC   156",
        LegacyUlaApplicationCsvService.choice(
            "156   (Conrad P T)", courseIds, notes, "First choice"));
    assertNull(LegacyUlaApplicationCsvService.choice("", courseIds, notes, "Second choice"));
    assertEquals(List.of(), notes);
    assertNull(
        LegacyUlaApplicationCsvService.choice("24   (Mirza D)", courseIds, notes, "Second choice"));
    assertEquals(
        List.of("Second choice on the form: CMPSC 24 (not offered in this recruitment)"), notes);
  }

  @Test
  public void the_major_is_matched_to_the_list_when_it_can_be() {
    List<String> majors = List.of("Computer Science", "Computer Engineering", "Statistics");
    assertEquals(
        "Computer Science",
        LegacyUlaApplicationCsvService.major("CMPSC (Computer Science)", majors));
    assertEquals(
        "Computer Engineering",
        LegacyUlaApplicationCsvService.major("CMPEN (Computer Engineering)", majors));
    assertEquals("Statistics", LegacyUlaApplicationCsvService.major("statistics", majors));
    assertEquals(
        "Statistics",
        LegacyUlaApplicationCsvService.major("PSTAT majors (ACTSC, Statistics, STSDS)", majors));
    assertEquals("Statistics", LegacyUlaApplicationCsvService.major("Stat", majors));
    assertEquals(
        "Applied Mathematics", LegacyUlaApplicationCsvService.major("Applied Mathematics", majors));
    assertNull(LegacyUlaApplicationCsvService.major(" ", majors));
  }

  @Test
  public void grid_ratings_take_the_list_s_spelling_and_skip_blank_or_odd_answers() {
    Columns columns =
        new Columns(
            new String[] {
              "Email Address",
              "First name",
              "Last name",
              "Rate your familiarity with each of these platforms [CSIL computing environment]",
              "Rate your familiarity with these languages/systems [Jupyter Notebooks]",
              "Rate your familiarity with these languages/systems [React]",
              "Rate your familiarity with these languages/systems []",
              "Rate your familiarity with no bracket",
              "Activity Interests [Exploring teaching as a career option]"
            });
    Row row =
        new Row(
            columns,
            new String[] {
              "a@ucsb.edu", "A", "B", "1-Very comfortable", "", "9-Not a level", "2-x", "3", "4"
            });
    assertEquals(
        Map.of("CSIL computing environment", 1),
        LegacyUlaApplicationCsvService.ratings(
            row, LegacyUlaApplicationCsvService.FAMILIARITY, List.of("Git/GitHub"), 3));
    // The list's spelling wins when a name matches exactly, or is what the label begins with.
    assertEquals(
        Map.of("CSIL", 1),
        LegacyUlaApplicationCsvService.ratings(
            row, LegacyUlaApplicationCsvService.FAMILIARITY, List.of("CSIL", "Git/GitHub"), 3));
    assertEquals(
        Map.of("csil computing environment", 1),
        LegacyUlaApplicationCsvService.ratings(
            row,
            LegacyUlaApplicationCsvService.FAMILIARITY,
            List.of("CSIL", "csil computing environment"),
            3));
    Map<String, String> byKey =
        Map.of("unixlinuxcommandline", "Unix/Linux command line", "unix", "Unix", "", "Blank");
    assertEquals(
        "Unix/Linux command line",
        LegacyUlaApplicationCsvService.listedName("Unix/Linux command line in general", byKey));
    assertEquals("Unix", LegacyUlaApplicationCsvService.listedName("Unix shells", byKey));
    assertEquals("Windows", LegacyUlaApplicationCsvService.listedName("Windows", byKey));
    assertEquals(
        Map.of("Exploring teaching as a career option", 4),
        LegacyUlaApplicationCsvService.ratings(
            row, LegacyUlaApplicationCsvService.ACTIVITY, List.of(), 5));
    assertEquals(
        Map.of("Exploring teaching as a career option", 4),
        LegacyUlaApplicationCsvService.ratings(
            row,
            LegacyUlaApplicationCsvService.ACTIVITY,
            List.of("Exploring teaching as a career option"),
            5));
  }

  @Test
  public void the_admin_comment_records_the_source_and_the_time() {
    assertEquals(
        "Imported from the ULA application form; submitted 5/9/2026 13:45:12.",
        LegacyUlaApplicationCsvService.adminComments("5/9/2026 13:45:12"));
    assertEquals(
        "Imported from the ULA application form.",
        LegacyUlaApplicationCsvService.adminComments(" "));
    assertNull(LegacyUlaApplicationCsvService.email("no at sign"));
    assertNull(LegacyUlaApplicationCsvService.email(null));
    assertEquals("a@ucsb.edu", LegacyUlaApplicationCsvService.email(" A@umail.ucsb.edu "));
  }

  /** The corners the main tests do not reach: odd grid labels and answers, and short rows. */
  @Test
  public void odd_grid_columns_and_answers_are_skipped_and_short_rows_read_blank() {
    Columns columns =
        new Columns(
            new String[] {
              "Email Address",
              "First name",
              "Last name",
              "Rate your familiarity with these languages/systems [Rust]",
              "Rate your familiarity with these languages/systems [Go]",
              "Rate your familiarity with these languages/systems [Zig]"
            });
    Row row =
        new Row(columns, new String[] {"a@ucsb.edu", "A", "B", "Very comfortable", "0-None", "x"});
    // a wordy answer, a level below 1 and a non-digit are all no rating
    assertEquals(
        Map.of(),
        LegacyUlaApplicationCsvService.ratings(
            row, LegacyUlaApplicationCsvService.FAMILIARITY, List.of(), 3));
    // the cell just past the end, and a negative index, read blank
    Row shortRow = new Row(columns, new String[] {"a@ucsb.edu", "A"});
    assertEquals("", shortRow.at(2));
    assertEquals("", shortRow.at(-1));
    assertEquals("A", shortRow.at(1));
    assertNull(LegacyUlaApplicationCsvService.email("   "));

    // the longest listed name that the label begins with wins, whichever is met first
    Map<String, String> longerFirst = new java.util.LinkedHashMap<>();
    longerFirst.put("unixlinuxcommandline", "Unix/Linux command line");
    longerFirst.put("unix", "Unix");
    Map<String, String> shorterFirst = new java.util.LinkedHashMap<>();
    shorterFirst.put("unix", "Unix");
    shorterFirst.put("unixlinuxcommandline", "Unix/Linux command line");
    for (Map<String, String> byKey : List.of(longerFirst, shorterFirst)) {
      assertEquals(
          "Unix/Linux command line",
          LegacyUlaApplicationCsvService.listedName("Unix/Linux command line in general", byKey));
    }
  }

  /** A course column with no number, and a free-text answer about TA eligibility. */
  @Test
  public void a_course_column_without_a_number_is_ignored_and_a_free_text_ta_answer_is_kept()
      throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId(any(), any())).thenReturn(false);
    String header =
        "Email Address,First name,Last name,Do you want to be eligible for TA positions after you"
            + " transition to graduate status?,Course Preferences [Tbd (Staff)],"
            + "Course Preferences [8   (Kharitonova Y)]\n";
    String row =
        "x@ucsb.edu,Xia,Yu,\"Yes, but I am graduating in S28\",1-Enthusiastic,1-Enthusiastic\n";

    service.upload(csv(header + row), ULA);

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(saved.capture());
    Application a = saved.getValue();
    assertEquals(Map.of("CMPSC     8", CourseInterest.ENTHUSIASTIC), a.getCourseInterests());
    assertNull(a.getWantsTaEligibility());
    assertEquals("About TA eligibility: Yes, but I am graduating in S28", a.getComments());
    assertEquals("Imported from the ULA application form.", a.getAdminComments());
    assertNull(a.getFirstChoiceCourse());
    assertTrue(a.getTopicProficiencies().isEmpty());
  }
}
