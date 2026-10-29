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
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.services.LegacyApplicationCsvService.ImportResult;
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

@SpringBootTest(classes = LegacyApplicationCsvService.class)
@ActiveProfiles("test")
public class LegacyApplicationCsvServiceTests {

  @Autowired LegacyApplicationCsvService service;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean TaTopicRepository taTopicRepository;
  @MockitoBean TaMajorRepository taMajorRepository;

  /** The committed, obfuscated export: the real format with no real data in it. */
  private static final Path SAMPLE = Path.of("docs/sample-data/legacy-ta-app-csv-example.csv");

  private static final Recruitment TA =
      Recruitment.builder().id(5L).quarter("20261").type(RecruitmentType.TA).build();

  private static final String HEADER =
      "date_modified,first_name,last_name,middle_name,email,residency_status,language_exam,"
          + "language_exam_date_passed,major,gpa_major,gpa_overall,class_level,year_in_program,"
          + "graduation_date,coursework_ucsb,coursework_other,coursework_290,knowledge,"
          + "prev_experience,desired_courses_grad,desired_courses_upper,desired_courses_lower,"
          + "comments_applicant,comments_reviewer,preferred_job,preferred_hours,date_submitted,"
          + "modified_by,application_quarter,must_hire,\n";

  private static final String ROW =
      "2025-11-20 10:00:00,Ada,Lovelace,Fakedata,Ada.Lovelace@umail.ucsb.edu,"
          + "F1 (Student) Visa,passed (F1 or J1 visa),Fall 2024,CS,3.9,3.8,PHD,2,06/2027,"
          + "\"130A:A,16:IP\",\"Intro to C:De Anza College:16,Algorithms::130B\","
          + "\"CMPSC 291A - Neural Information Retrieval:Dagny G. Sandoval-Rey:A+\","
          + "\"C++:3,Python:5,TeachingBasicsToBeginners:4\",\"130A:TA:Fall 2024,8:Reader:\",,"
          + "\"111,156\",\"8,16\",Happy to help&#44; anywhere.,Strong candidate,TA Only,20,"
          + "2025-11-01 09:00:00,admin,W26,0,\n";

  private static MockMultipartFile csv(String content) {
    return new MockMultipartFile(
        "file", "legacy.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8));
  }

  private static RecruitmentCourse course(String courseId, boolean removed) {
    return RecruitmentCourse.builder()
        .recruitmentId(5L)
        .courseId(courseId)
        .enrollCode(courseId)
        .removed(removed)
        .build();
  }

  private void defaultLists() {
    when(recruitmentCourseRepository.findByRecruitmentId(5L))
        .thenReturn(
            List.of(
                course("CMPSC     8", false),
                course("CMPSC    16", false),
                course("CMPSC   130A", false),
                course("CMPSC   156", true)));
    when(taTopicRepository.findAll())
        .thenReturn(
            List.of(
                TaTopic.builder().name("C++").build(),
                TaTopic.builder().name("Teaching basics to beginners").build()));
    // Spelled so "CS" matches only by reading the list: the fallback would say "Computer Science".
    when(taMajorRepository.findAll())
        .thenReturn(
            List.of(
                TaMajor.builder().name("Computer Engineering").build(),
                TaMajor.builder().name("Computer Science (MS/PhD)").build()));
  }

  // ---- the quarter ----

  @Test
  public void a_quarter_may_be_written_as_qyy_or_yyyyq() {
    assertEquals("20261", LegacyApplicationCsvService.toYyyyq("W26"));
    assertEquals("20262", LegacyApplicationCsvService.toYyyyq(" s26 "));
    assertEquals("20253", LegacyApplicationCsvService.toYyyyq("M25"));
    assertEquals("20254", LegacyApplicationCsvService.toYyyyq("f25"));
    assertEquals("20261", LegacyApplicationCsvService.toYyyyq("20261"));
    for (String bad : new String[] {"", "W2026", "X26", "20265", "2026", "Winter 2026", null}) {
      IllegalArgumentException e =
          assertThrows(
              IllegalArgumentException.class, () -> LegacyApplicationCsvService.toYyyyq(bad));
      assertEquals(
          "Quarter should be like W26, S26, M26 or F26 (or 20261), not '%s'".formatted(bad),
          e.getMessage());
    }
  }

  // ---- the upload as a whole ----

  @Test
  public void the_sample_export_imports_whole_with_one_application_per_row() throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId(any(), any())).thenReturn(false);
    MockMultipartFile file =
        new MockMultipartFile("file", "legacy.csv", "text/csv", Files.readAllBytes(SAMPLE));

    ImportResult result = service.upload(file, TA);

    // The sample's knowledge topics, less the two already on the list, are added to it, once each.
    List<String> expectedAdded =
        List.of(
            "Assembly/MIPS",
            "C",
            "Compilers",
            "Cryptography",
            "Java",
            "Mathematics",
            "Mobile App Development",
            "Professional/Industry SWE",
            "Python",
            "Unix/Linux",
            "VR/AR/Mixed Reality");
    assertEquals(new ImportResult(86, 0, 0, List.of(), result.addedTopics()), result);
    assertEquals(expectedAdded, result.addedTopics().stream().sorted().toList());
    assertEquals(expectedAdded.size(), result.addedTopics().size());
    verify(taTopicRepository, times(expectedAdded.size())).save(any());
    assertEquals(86, result.inserted());
    assertEquals(0, result.alreadyPresent());
    assertEquals(0, result.skipped());
    assertEquals(List.of(), result.problems());
    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(86)).save(saved.capture());
    for (Application a : saved.getAllValues()) {
      assertEquals(5L, a.getRecruitmentId());
      assertEquals(ApplicationReviewStatus.PENDING, a.getStatus());
      assertFalse(a.isTestApplication());
      assertNull(a.getNoticeVersionId());
      assertEquals("Fakedata", a.getMiddleName());
      assertTrue(a.getEmail().contains("@"));
      assertTrue(a.getAdminComments().startsWith("Imported from the legacy TA application"));
    }
  }

  @Test
  public void a_row_already_imported_is_counted_and_a_row_without_an_email_is_reported()
      throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId("ada.lovelace@ucsb.edu", 5L))
        .thenReturn(true);
    String noEmail = ROW.replace("Ada.Lovelace@umail.ucsb.edu", "not an address");
    String blankRow = ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n";

    ImportResult result = service.upload(csv(HEADER + ROW + noEmail + blankRow + ROW), TA);

    assertEquals(
        new ImportResult(0, 2, 1, List.of("row 3: no usable email address"), List.of()), result);
    assertEquals(List.of(), result.addedTopics());
    verify(taTopicRepository, never()).save(any());
    assertEquals(0, result.inserted());
    assertEquals(2, result.alreadyPresent());
    assertEquals(1, result.skipped());
    assertEquals(List.of("row 3: no usable email address"), result.problems());
    verify(applicationRepository, never()).save(any());
  }

  @Test
  public void a_new_row_is_mapped_and_saved() throws Exception {
    defaultLists();
    when(applicationRepository.existsByEmailAndRecruitmentId(any(), any())).thenReturn(false);

    ImportResult result = service.upload(csv(HEADER + ROW), TA);

    // Python is rated but not on the TA topics list, so it is added; the other two were there.
    assertEquals(new ImportResult(1, 0, 0, List.of(), List.of("Python")), result);
    verify(taTopicRepository, times(1)).save(TaTopic.builder().name("Python").build());
    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(saved.capture());
    Application a = saved.getValue();

    // identity, canonical email
    assertEquals("ada.lovelace@ucsb.edu", a.getEmail());
    assertEquals(5L, a.getRecruitmentId());
    assertEquals("Ada", a.getFirstName());
    assertEquals("Fakedata", a.getMiddleName());
    assertEquals("Lovelace", a.getLastName());
    // plain fields
    assertEquals("Computer Science (MS/PhD)", a.getMajor());
    assertEquals(3.9, a.getGpaMajor());
    assertEquals(3.8, a.getGpaOverall());
    assertEquals("2", a.getYearInProgram());
    assertEquals("06/2027", a.getGraduationDate());
    assertEquals(ResidencyStatus.F1_STUDENT_VISA, a.getResidencyStatus());
    assertEquals(LanguageExamStatus.PASSED_F1_OR_J1_VISA, a.getLanguageExam());
    assertEquals("Fall 2024", a.getLanguageExamDatePassed());
    assertEquals(ClassLevel.PHD, a.getClassLevel());
    // lists
    assertEquals("CMPSC 130A: TA, Fall 2024\nCMPSC 8: Reader", a.getPrevExperience());
    assertEquals(
        Map.of("C++", 3, "Python", 5, "Teaching basics to beginners", 4),
        a.getTopicProficiencies());
    // 111 is not in the recruitment, 156 is removed from it: both go to the comments instead
    assertEquals(
        Map.of(
            "CMPSC     8", CourseInterest.ENTHUSIASTIC, "CMPSC    16", CourseInterest.ENTHUSIASTIC),
        a.getCourseInterests());
    assertEquals(
        "Happy to help, anywhere.\nPreferred job: TA Only\nPreferred hours per week: 20\n"
            + "Also interested in: CMPSC 111, CMPSC 156",
        a.getComments());
    assertEquals(
        "Imported from the legacy TA application; legacy quarter W26; submitted 2025-11-01"
            + " 09:00:00; last modified 2025-11-20 10:00:00.\nReviewer comments: Strong candidate",
        a.getAdminComments());
    assertTrue(a.getInterests().isEmpty());
    assertNull(a.getFirstChoiceCourse());
    // coursework: UCSB, then elsewhere, then 290-level
    List<PriorCoursework> courses = a.getPriorCoursework();
    assertEquals(5, courses.size());
    assertEquals(
        PriorCoursework.builder().ucsbCourse(true).courseNumber("CMPSC 130A").grade("A").build(),
        courses.get(0));
    assertEquals(
        PriorCoursework.builder().ucsbCourse(true).courseNumber("CMPSC 16").grade("IP").build(),
        courses.get(1));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(false)
            .otherSchool("De Anza College")
            .courseNumber("CMPSC 16 (equivalent)")
            .courseTitle("Intro to C")
            .build(),
        courses.get(2));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(false)
            .otherSchool("(school not given)")
            .courseNumber("CMPSC 130B (equivalent)")
            .courseTitle("Algorithms")
            .build(),
        courses.get(3));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 291A")
            .courseTitle("Neural Information Retrieval (Dagny G. Sandoval-Rey)")
            .grade("A+")
            .build(),
        courses.get(4));
  }

  @Test
  public void only_a_ta_recruitment_an_empty_file_or_a_file_with_the_columns_is_accepted() {
    Recruitment ula = Recruitment.builder().id(6L).type(RecruitmentType.ULA).build();
    ResponseStatusException e =
        assertThrows(ResponseStatusException.class, () -> service.upload(csv(HEADER + ROW), ula));
    assertEquals(400, e.getStatusCode().value());
    assertEquals(
        "Legacy TA applications can only be imported into a TA recruitment", e.getReason());

    defaultLists();
    e = assertThrows(ResponseStatusException.class, () -> service.upload(csv(""), TA));
    assertEquals(400, e.getStatusCode().value());
    assertEquals("CSV file is empty", e.getReason());

    e =
        assertThrows(
            ResponseStatusException.class,
            () -> service.upload(csv("Email,first_name\nx@ucsb.edu,X\n"), TA));
    assertEquals(400, e.getStatusCode().value());
    assertEquals("CSV file is missing the column(s) [last_name]", e.getReason());
    verify(applicationRepository, never()).save(any());
  }

  /** Header names are matched ignoring case and blanks; a short row reads blank where it ends. */
  @Test
  public void headers_are_matched_leniently_and_short_rows_are_padded() {
    Map<String, Integer> columns =
        LegacyApplicationCsvService.columnIndexes(
            new String[] {" EMAIL ", "First_Name", "", "last_name", "email"});
    assertEquals(Map.of("email", 0, "first_name", 1, "last_name", 3), columns);
    Map<String, String> row =
        LegacyApplicationCsvService.rowMap(columns, new String[] {" a@ucsb.edu ", "A"});
    assertEquals(Map.of("email", "a@ucsb.edu", "first_name", "A", "last_name", ""), row);
    // a row exactly one cell short reads blank in that cell, not out of bounds
    assertEquals(
        Map.of("email", "x", "first_name", "", "last_name", "Z"),
        LegacyApplicationCsvService.rowMap(
            Map.of("email", 0, "last_name", 1, "first_name", 2), new String[] {"x", "Z"}));
    assertEquals("a@ucsb.edu", LegacyApplicationCsvService.email(row));
    assertNull(LegacyApplicationCsvService.email(Map.of("email", "   ")));
    assertNull(LegacyApplicationCsvService.email(Map.of()));
  }

  // ---- field by field ----

  @Test
  public void blank_and_zero_answers_are_no_answer() {
    assertNull(LegacyApplicationCsvService.blankToNull(null));
    assertNull(LegacyApplicationCsvService.blankToNull("  "));
    assertEquals("x", LegacyApplicationCsvService.blankToNull(" x "));
    assertNull(LegacyApplicationCsvService.textOrNullForZero("0"));
    assertNull(LegacyApplicationCsvService.textOrNullForZero(""));
    assertEquals("Fall 2023", LegacyApplicationCsvService.textOrNullForZero("Fall 2023"));
    assertNull(LegacyApplicationCsvService.gpa(null));
    assertNull(LegacyApplicationCsvService.gpa("0"));
    assertNull(LegacyApplicationCsvService.gpa("n/a"));
    assertEquals(3.75, LegacyApplicationCsvService.gpa(" 3.75"));
    assertEquals(4.0, LegacyApplicationCsvService.gpa("4"));
  }

  @Test
  public void the_major_is_matched_to_the_list_when_it_can_be() {
    List<String> majors = List.of("Computer Engineering", "Computer Science");
    assertEquals("Computer Science", LegacyApplicationCsvService.major("CS", majors));
    assertEquals("Computer Science", LegacyApplicationCsvService.major("cs", majors));
    assertEquals("Computer Science", LegacyApplicationCsvService.major("computer science", majors));
    assertEquals("Computer Engineering", LegacyApplicationCsvService.major("Engineering", majors));
    assertEquals("Other", LegacyApplicationCsvService.major("Other", majors));
    assertEquals("Computer Science", LegacyApplicationCsvService.major("CS", List.of()));
    assertNull(LegacyApplicationCsvService.major(" ", majors));
  }

  @Test
  public void residency_language_exam_and_class_level_are_matched_by_their_words() {
    assertEquals(ResidencyStatus.US_CITIZEN, LegacyApplicationCsvService.residency("U.S. Citizen"));
    assertEquals(
        ResidencyStatus.US_RESIDENT, LegacyApplicationCsvService.residency("U.S. Resident"));
    assertEquals(
        ResidencyStatus.F1_STUDENT_VISA,
        LegacyApplicationCsvService.residency("F1 (Student) Visa"));
    assertEquals(
        ResidencyStatus.F1_STUDENT_VISA, LegacyApplicationCsvService.residency("F-1 visa"));
    assertEquals(ResidencyStatus.J1_STUDENT_VISA, LegacyApplicationCsvService.residency("J1 visa"));
    assertEquals(ResidencyStatus.J1_STUDENT_VISA, LegacyApplicationCsvService.residency("j-1"));
    assertEquals(ResidencyStatus.OTHER, LegacyApplicationCsvService.residency("H4"));
    assertNull(LegacyApplicationCsvService.residency(""));

    assertEquals(
        LanguageExamStatus.EXEMPT_US_CITIZEN,
        LegacyApplicationCsvService.languageExam("exempt (U.S. Citizen)"));
    assertEquals(
        LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT,
        LegacyApplicationCsvService.languageExam("passed (U.S. Perm. Resident)"));
    assertEquals(
        LanguageExamStatus.PASSED_F1_OR_J1_VISA,
        LegacyApplicationCsvService.languageExam("passed (F1 or J1 visa)"));
    assertEquals(
        LanguageExamStatus.NOT_PASSED, LegacyApplicationCsvService.languageExam("not passed"));
    assertEquals(
        LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT,
        LegacyApplicationCsvService.languageExam("resident"));
    assertNull(LegacyApplicationCsvService.languageExam("n/a"));
    assertNull(LegacyApplicationCsvService.languageExam(null));

    assertEquals(ClassLevel.PHD, LegacyApplicationCsvService.classLevel("PHD"));
    assertEquals(ClassLevel.PHD, LegacyApplicationCsvService.classLevel("Ph.D."));
    assertEquals(ClassLevel.MS, LegacyApplicationCsvService.classLevel("MS"));
    assertEquals(ClassLevel.MS, LegacyApplicationCsvService.classLevel("Masters"));
    assertNull(LegacyApplicationCsvService.classLevel("BS"));
    assertNull(LegacyApplicationCsvService.classLevel(" "));
  }

  @Test
  public void list_cells_split_into_entries_with_the_right_number_of_fields() {
    List<String[]> entries =
        LegacyApplicationCsvService.entries("130A:A, 16 : IP ,bad,,:,Spec&#58; Topics:B", 2);
    assertEquals(4, entries.size());
    assertEquals(List.of("130A", "A"), List.of(entries.get(0)));
    assertEquals(List.of("16", "IP"), List.of(entries.get(1)));
    assertEquals(List.of("", ""), List.of(entries.get(2)));
    assertEquals(List.of("Spec: Topics", "B"), List.of(entries.get(3)));
    assertTrue(LegacyApplicationCsvService.entries(null, 2).isEmpty());
    assertTrue(LegacyApplicationCsvService.entries("  ", 2).isEmpty());
  }

  @Test
  public void legacy_course_numbers_get_the_department_prefix() {
    assertEquals("CMPSC 130A", LegacyApplicationCsvService.courseNumber("130A"));
    assertEquals("CMPSC 8", LegacyApplicationCsvService.courseNumber(" 8 "));
    assertEquals("CMPSC 189A/B", LegacyApplicationCsvService.courseNumber("189A/B"));
    assertEquals("ECE 283", LegacyApplicationCsvService.courseNumber("ECE 283"));
    assertEquals("CMPSC 156", LegacyApplicationCsvService.courseNumber("CMPSC 156"));
  }

  @Test
  public void coursework_cells_become_prior_course_rows_and_odd_entries_are_skipped() {
    Map<String, String> row =
        Map.of(
            "coursework_ucsb", ":A,64:",
            "coursework_other", "::,Data Mining:Nankai University:,:Koc University:130A",
            "coursework_290",
                "::A,291I Future User Interfaces::IP,Classic Papers:Bram Noemi:A,CS292F:X Y:B-,"
                    + "cmpsc 293b - Blockchains:Oskar Juhl:A");
    List<PriorCoursework> courses = LegacyApplicationCsvService.priorCoursework(row);
    assertEquals(7, courses.size());
    assertEquals(
        PriorCoursework.builder().ucsbCourse(true).courseNumber("CMPSC 64").grade(null).build(),
        courses.get(0));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(false)
            .otherSchool("Nankai University")
            .courseNumber("Data Mining")
            .courseTitle("Data Mining")
            .build(),
        courses.get(1));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(false)
            .otherSchool("Koc University")
            .courseNumber("CMPSC 130A (equivalent)")
            .courseTitle(null)
            .build(),
        courses.get(2));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 291I")
            .courseTitle("Future User Interfaces")
            .grade("IP")
            .build(),
        courses.get(3));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 290-level")
            .courseTitle("Classic Papers (Bram Noemi)")
            .grade("A")
            .build(),
        courses.get(4));
    // a code but no title: the title is just the instructor
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 292F")
            .courseTitle("(X Y)")
            .grade("B-")
            .build(),
        courses.get(5));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 293B")
            .courseTitle("Blockchains (Oskar Juhl)")
            .grade("A")
            .build(),
        courses.get(6));
    // neither title nor instructor: no title at all
    courses = LegacyApplicationCsvService.priorCoursework(Map.of("coursework_290", "CS292F::B"));
    assertEquals("CMPSC 292F", courses.get(0).getCourseNumber());
    assertNull(courses.get(0).getCourseTitle());
    assertTrue(LegacyApplicationCsvService.priorCoursework(Map.of()).isEmpty());
  }

  @Test
  public void previous_experience_becomes_one_line_per_course() {
    assertEquals(
        "CMPSC 130A: TA, Fall 2024\nCMPSC 8: Reader\nCMPSC 16, Winter 2025\nCMPSC 24",
        LegacyApplicationCsvService.prevExperience(
            "130A:TA:Fall 2024,8:Reader:,16::Winter 2025,24::,::Spring 2025"));
    assertNull(LegacyApplicationCsvService.prevExperience(""));
    assertNull(LegacyApplicationCsvService.prevExperience("::"));
  }

  @Test
  public void knowledge_ratings_take_the_topics_list_s_spelling_or_a_readable_legacy_name() {
    List<String> topics = List.of("C++", "Unix / Linux", "Mobile App Development");
    Map<String, Integer> ratings =
        LegacyApplicationCsvService.knowledge(
            "C++:3,Unix/Linux:5,MobileAppDevelopment:1,TeachingBasicsToBeginners:4,"
                + "Professional/IndustrySWE:2,Java:0,Python:6,Rust:x,:3",
            topics);
    assertEquals(
        Map.of(
            "C++", 3,
            "Unix / Linux", 5,
            "Mobile App Development", 1,
            "Teaching Basics To Beginners", 4,
            "Professional/Industry SWE", 2),
        ratings);
    assertTrue(LegacyApplicationCsvService.knowledge(null, topics).isEmpty());
    assertEquals("c++", LegacyApplicationCsvService.key("C++"));
    assertEquals("c", LegacyApplicationCsvService.key("C"));
    assertEquals("unixlinux", LegacyApplicationCsvService.key("Unix / Linux"));
    // C is rated but only C++ is on the list: they must not be confused
    assertEquals(
        Map.of("C", 2, "C++", 3),
        LegacyApplicationCsvService.knowledge("C:2,C++:3", List.of("C++")));
    assertEquals("C++", LegacyApplicationCsvService.prettify("C++"));
  }

  @Test
  public void desired_courses_become_enthusiastic_interest_in_the_recruitment_s_courses() {
    Set<String> courseIds = new TreeSet<>(List.of("CMPSC     8", "CMPSC   130A", "CMPSC   156"));
    List<String> unmatched = new ArrayList<>();
    Map<String, CourseInterest> interests =
        LegacyApplicationCsvService.desiredCourses(
            "130a,156,111, ,156", "8,16,111", courseIds, unmatched);
    assertEquals(
        Map.of(
            "CMPSC   130A", CourseInterest.ENTHUSIASTIC,
            "CMPSC   156", CourseInterest.ENTHUSIASTIC,
            "CMPSC     8", CourseInterest.ENTHUSIASTIC),
        interests);
    assertEquals(List.of("CMPSC 111", "CMPSC 16"), unmatched);
    assertEquals("156", LegacyApplicationCsvService.numberOf("CMPSC   156"));
    assertTrue(
        LegacyApplicationCsvService.desiredCourses(null, null, courseIds, new ArrayList<>())
            .isEmpty());
  }

  @Test
  public void comments_keep_what_the_new_form_has_no_field_for() {
    assertNull(LegacyApplicationCsvService.comments(Map.of(), List.of()));
    assertEquals(
        "Preferred job: Both - Prefer TA",
        LegacyApplicationCsvService.comments(
            Map.of("preferred_job", "Both - Prefer TA", "preferred_hours", "0"), List.of()));
    assertEquals(
        "I can TA anything.\nPreferred hours per week: 10\nAlso interested in: CMPSC 111",
        LegacyApplicationCsvService.comments(
            Map.of("comments_applicant", "I can TA anything.", "preferred_hours", "10"),
            List.of("CMPSC 111")));
  }

  /** must_hire is left out whatever it says: the column was unused and always reads no (#74). */
  @Test
  public void admin_comments_record_where_the_row_came_from_but_never_must_hire() {
    assertEquals(
        "Imported from the legacy TA application.",
        LegacyApplicationCsvService.adminComments(Map.of("must_hire", "0")));
    assertEquals(
        "Imported from the legacy TA application.",
        LegacyApplicationCsvService.adminComments(Map.of("must_hire", "1")));
    assertEquals(
        "Imported from the legacy TA application.",
        LegacyApplicationCsvService.adminComments(Map.of()));
    assertEquals(
        "Imported from the legacy TA application; legacy quarter F25; submitted 2025-11-01"
            + " 09:00:00; last modified 2025-11-02 10:00:00.\n"
            + "Reviewer comments: Hire, please",
        LegacyApplicationCsvService.adminComments(
            Map.of(
                "application_quarter", "F25",
                "date_submitted", "2025-11-01 09:00:00",
                "date_modified", "2025-11-02 10:00:00",
                "must_hire", "1",
                "comments_reviewer", "Hire&#44; please")));
  }
}
