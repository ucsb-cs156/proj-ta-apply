package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

public class FakeApplicationGeneratorTests {

  static final List<String> COURSES =
      List.of(
          "CMPSC   16", "CMPSC  130A", "CMPSC  156", "CMPSC  165A", "CMPSC  170", "CMPSC  190J");

  /** In winter 2026, so the latest course on every transcript is in W26. */
  static final LocalDate TODAY = LocalDate.of(2026, 2, 10);

  private final FakeCoursework coursework = new FakeCoursework();
  private final CourseRepository courses = mock(CourseRepository.class);
  private final TaTopicRepository taTopics = mock(TaTopicRepository.class);
  private final UlaTopicRepository ulaTopics = mock(UlaTopicRepository.class);
  private final UlaInterestRepository ulaInterests = mock(UlaInterestRepository.class);
  private final TaMajorRepository taMajors = mock(TaMajorRepository.class);
  private final UlaMajorRepository ulaMajors = mock(UlaMajorRepository.class);
  private final FakeApplicationGenerator generator =
      new FakeApplicationGenerator(
          coursework, courses, taTopics, ulaTopics, ulaInterests, taMajors, ulaMajors);

  private static Recruitment recruitment(RecruitmentType type) {
    return Recruitment.builder().id(7L).quarter("20261").type(type).build();
  }

  private void withSettings() {
    when(taTopics.findAll())
        .thenReturn(
            List.of(
                TaTopic.builder().name("Python").build(), TaTopic.builder().name("Java").build()));
    when(ulaTopics.findAll())
        .thenReturn(
            List.of(
                UlaTopic.builder().name("SQL").build(), UlaTopic.builder().name("Git").build()));
    when(ulaInterests.findAll())
        .thenReturn(
            List.of(
                UlaInterest.builder().name("Office hours").build(),
                UlaInterest.builder().name("Grading").build()));
    when(taMajors.findAll())
        .thenReturn(
            List.of(
                TaMajor.builder().name("Applied Math").build(),
                TaMajor.builder().name("Statistics").build()));
    when(ulaMajors.findAll())
        .thenReturn(
            List.of(
                UlaMajor.builder().name("Physics").build(),
                UlaMajor.builder().name("Chemistry").build()));
  }

  private List<Application> generate(
      RecruitmentType type, int count, FakeCoverage coverage, long seed, Set<String> taken) {
    return generator.generate(
        recruitment(type), COURSES, count, coverage, new Random(seed), taken, TODAY);
  }

  private List<Application> generate(RecruitmentType type, int count, FakeCoverage coverage) {
    return generate(type, count, coverage, 42L, new HashSet<>());
  }

  // ---- identity ----

  @Test
  public void every_fake_applicant_is_unmistakably_fake() {
    withSettings();
    for (RecruitmentType type : RecruitmentType.values()) {
      for (Application a : generate(type, 50, FakeCoverage.ALL)) {
        assertEquals(ApplicationOrigin.DEVELOPER_MODE, a.getOrigin());
        assertEquals(7L, a.getRecruitmentId());
        assertEquals("Fakedata", a.getMiddleName());
        assertFalse(a.getFirstName().isBlank());
        assertFalse(a.getLastName().isBlank());
        assertEquals(
            (a.getFirstName() + "." + a.getLastName()).toLowerCase(),
            a.getEmail().substring(0, a.getEmail().indexOf('@')).replaceAll("\\d+$", ""));
        assertTrue(a.getEmail().endsWith("@fake.ucsb.edu"));
      }
    }
  }

  @Test
  public void emails_never_repeat_each_other_or_those_already_taken() {
    withSettings();
    Set<String> taken = new HashSet<>(Set.of("alex.abbott@fake.ucsb.edu", "someone@ucsb.edu"));
    Set<String> before = new HashSet<>(taken);

    // More than the 676 first/last combinations, so numbered emails are unavoidable.
    List<Application> applications =
        generate(RecruitmentType.TA, 1500, FakeCoverage.ALL, 5L, taken);

    Set<String> emails =
        applications.stream().map(Application::getEmail).collect(Collectors.toSet());
    assertEquals(1500, emails.size());
    emails.retainAll(before);
    assertTrue(emails.isEmpty());
    assertEquals(1500 + before.size(), taken.size());
    assertTrue(
        applications.stream()
            .anyMatch(a -> a.getEmail().matches("[a-z]+\\.[a-z]+2@fake\\.ucsb\\.edu")));
  }

  @Test
  public void numbered_emails_count_up_from_two_and_nothing_else_is_appended() {
    withSettings();
    List<Application> applications =
        generate(RecruitmentType.TA, 1500, FakeCoverage.ALL, 5L, new HashSet<>());

    assertTrue(
        applications.stream()
            .allMatch(
                a -> a.getEmail().matches("[a-z]+\\.[a-z]+([2-9]|[1-9]\\d+)?@fake\\.ucsb\\.edu")));
    assertTrue(
        applications.stream()
            .anyMatch(a -> a.getEmail().matches("[a-z]+\\.[a-z]+3@fake\\.ucsb\\.edu")));
  }

  @Test
  public void the_same_seed_gives_the_same_applications() {
    withSettings();
    assertEquals(
        generate(RecruitmentType.TA, 30, FakeCoverage.SPARSE),
        generate(RecruitmentType.TA, 30, FakeCoverage.SPARSE));
    assertEquals(
        generate(RecruitmentType.ULA, 30, FakeCoverage.ALL),
        generate(RecruitmentType.ULA, 30, FakeCoverage.ALL));
    assertFalse(
        generate(RecruitmentType.TA, 30, FakeCoverage.ALL, 1L, new HashSet<>())
            .equals(generate(RecruitmentType.TA, 30, FakeCoverage.ALL, 2L, new HashSet<>())));
  }

  // ---- TA ----

  private Set<String> schools(boolean international) {
    Set<String> schools = new HashSet<>();
    for (int seed = 0; seed < 200; seed++) {
      schools.add(
          coursework
              .other(new Random(seed * 1_000_003L), 1, international, 20261)
              .get(0)
              .getOtherSchool());
    }
    return schools;
  }

  @Test
  public void ta_applications_carry_every_answer_the_form_requires() {
    withSettings();
    Set<String> international = schools(true);
    Set<String> domestic = schools(false);
    Set<ResidencyStatus> residencies = new HashSet<>();
    Set<ClassLevel> levels = new HashSet<>();
    int ucsbPaths = 0;
    int otherPaths = 0;
    int firstQuarter = 0;

    for (Application a : generate(RecruitmentType.TA, 600, FakeCoverage.ALL)) {
      residencies.add(a.getResidencyStatus());
      levels.add(a.getClassLevel());
      assertTrue(Set.of("Applied Math", "Statistics").contains(a.getMajor()));
      if (a.isFirstQuarter()) {
        // Issue #292: only a first-year grad student, who has no GPAs yet.
        firstQuarter++;
        assertNull(a.getGpaMajor());
        assertNull(a.getGpaOverall());
        assertEquals("1st", a.getYearInProgram());
      } else {
        assertTrue(a.getGpaMajor() >= 3.0 && a.getGpaMajor() <= 4.0);
        assertTrue(a.getGpaOverall() >= 3.0 && a.getGpaOverall() <= 4.0);
        assertEquals(a.getGpaMajor(), Math.round(a.getGpaMajor() * 100) / 100.0);
      }
      assertTrue(a.getYearInProgram().matches("[1-5](st|nd|rd|th)"));
      assertNotNull(a.getPrevExperience());
      assertNotNull(a.getComments());
      assertTrue(
          a.getTopicProficiencies().keySet().stream().allMatch(Set.of("Python", "Java")::contains));
      assertTrue(a.getTopicProficiencies().values().stream().allMatch(v -> v >= 1 && v <= 5));
      // Nothing from the ULA form.
      assertNull(a.getPermNumber());
      assertNull(a.getPreviousServiceAsUla());
      assertNull(a.getVideoLink());
      assertTrue(a.getInterests().isEmpty());
      assertFalse(a.isAvailableForLecturesFirstChoice());
      assertNull(a.getAvailabilityCommentsFirstChoice());

      int year = Integer.parseInt(a.getYearInProgram().substring(0, 1));
      if (a.getClassLevel() == ClassLevel.MS) {
        assertTrue(year <= 2);
        assertEquals(
            "S" + String.format("%02d", Math.max(26, 26 + 2 - year)), a.getGraduationDate());
      } else {
        assertEquals(
            "S" + String.format("%02d", Math.max(26, 26 + 5 - year)), a.getGraduationDate());
      }

      switch (a.getResidencyStatus()) {
        case US_CITIZEN -> {
          assertEquals(LanguageExamStatus.EXEMPT_US_CITIZEN, a.getLanguageExam());
          assertNull(a.getLanguageExamDatePassed());
        }
        case US_RESIDENT -> {
          assertEquals(LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT, a.getLanguageExam());
          assertTrue(
              FakeApplicationGenerator.TA_RESIDENCY_EXAM_PASS_QUARTERS.contains(
                  a.getLanguageExamDatePassed()));
        }
        default -> {
          assertEquals(LanguageExamStatus.PASSED_F1_OR_J1_VISA, a.getLanguageExam());
          assertTrue(
              FakeApplicationGenerator.TA_RESIDENCY_EXAM_PASS_QUARTERS.contains(
                  a.getLanguageExamDatePassed()));
        }
      }

      boolean visa =
          a.getResidencyStatus() == ResidencyStatus.F1_STUDENT_VISA
              || a.getResidencyStatus() == ResidencyStatus.J1_STUDENT_VISA;
      List<PriorCoursework> prior = a.getPriorCoursework();
      List<PriorCoursework> graduate = prior.subList(prior.size() - 5, prior.size());
      List<PriorCoursework> undergraduate = prior.subList(0, prior.size() - 5);
      assertTrue(
          graduate.stream()
              .allMatch(
                  c -> c.isUcsbCourse() && c.getCourseNumber().matches("CMPSC [2-9]\\d\\d.*")));
      // Both the undergraduate courses and the graduate ones end in the quarter of TODAY.
      assertEquals("W26", undergraduate.get(undergraduate.size() - 1).getTerm());
      assertEquals("W26", graduate.get(4).getTerm());

      if (undergraduate.get(0).isUcsbCourse()) {
        // The UCSB path is for citizens and residents only, and is a fourth-year's: 19 to 24.
        assertFalse(visa);
        ucsbPaths++;
        assertTrue(undergraduate.size() >= 19 && undergraduate.size() <= 24);
        assertTrue(undergraduate.stream().allMatch(PriorCoursework::isUcsbCourse));
      } else {
        otherPaths++;
        assertEquals(10, undergraduate.size());
        assertTrue(undergraduate.stream().noneMatch(PriorCoursework::isUcsbCourse));
        // Ten courses from one school, domestic for a citizen or resident, else international.
        Set<String> chosen =
            undergraduate.stream().map(PriorCoursework::getOtherSchool).collect(Collectors.toSet());
        assertEquals(1, chosen.size());
        assertTrue((visa ? international : domestic).containsAll(chosen));
        assertTrue((visa ? domestic : international).stream().noneMatch(chosen::contains));
      }
    }

    // Residency is spread over four values, never OTHER; both class levels and both paths occur.
    assertEquals(
        Set.of(
            ResidencyStatus.US_CITIZEN,
            ResidencyStatus.US_RESIDENT,
            ResidencyStatus.F1_STUDENT_VISA,
            ResidencyStatus.J1_STUDENT_VISA),
        residencies);
    assertEquals(Set.of(ClassLevel.PHD, ClassLevel.MS), levels);
    // Half of the 600 are visa holders, who never take the UCSB path; of the other half, a coin
    // flip decides, so about 150 each.
    assertTrue(ucsbPaths > 100 && ucsbPaths < 200, "UCSB " + ucsbPaths);
    assertTrue(firstQuarter > 10 && firstQuarter < 120, "first quarter " + firstQuarter);
    assertTrue(otherPaths > 400 && otherPaths < 500, "other " + otherPaths);
  }

  @Test
  public void ta_residency_is_uniform_over_its_four_values() {
    withSettings();
    Map<ResidencyStatus, Long> counts =
        generate(RecruitmentType.TA, 4000, FakeCoverage.ALL).stream()
            .collect(Collectors.groupingBy(Application::getResidencyStatus, Collectors.counting()));

    for (long count : counts.values()) {
      assertTrue(count > 850 && count < 1150, counts.toString());
    }
    assertEquals(4, counts.size());
  }

  @Test
  public void citizens_and_residents_flip_a_coin_between_ucsb_and_another_school() {
    withSettings();
    long ucsb = 0;
    long usTotal = 0;
    for (Application a : generate(RecruitmentType.TA, 4000, FakeCoverage.ALL)) {
      if (a.getResidencyStatus() == ResidencyStatus.US_CITIZEN
          || a.getResidencyStatus() == ResidencyStatus.US_RESIDENT) {
        usTotal++;
        if (a.getPriorCoursework().get(0).isUcsbCourse()) {
          ucsb++;
        }
      }
    }
    assertEquals(0.5, ucsb / (double) usTotal, 0.04);
  }

  // ---- ULA ----

  @Test
  public void ula_applications_carry_every_answer_the_form_requires() {
    withSettings();
    Set<Integer> years = new HashSet<>();
    Set<TrainingCommitment> commitments = new HashSet<>();
    boolean sawBsMs = false;
    boolean sawEmployed = false;
    boolean sawChanging = false;
    boolean sawLecture1 = false;
    boolean sawLecture2 = false;
    boolean sawDiscussion1 = false;
    boolean sawDiscussion2 = false;
    int firstQuarter = 0;

    for (Application a : generate(RecruitmentType.ULA, 1500, FakeCoverage.ALL)) {
      int year = Integer.parseInt(a.getYearInProgram().substring(0, 1));
      years.add(year);
      assertEquals("S" + String.format("%02d", 26 + 4 - year), a.getGraduationDate());
      assertTrue(Set.of("Physics", "Chemistry").contains(a.getMajor()));
      if (a.isFirstQuarter()) {
        // Issue #292: only a first-year student, who has no GPAs yet.
        firstQuarter++;
        assertNull(a.getGpaMajor());
        assertNull(a.getGpaOverall());
        assertEquals(1, year);
      } else {
        assertTrue(a.getGpaMajor() >= 2.7 && a.getGpaMajor() <= 4.0);
        assertTrue(a.getGpaOverall() >= 2.7 && a.getGpaOverall() <= 4.0);
      }
      assertTrue(a.getPermNumber().matches("[A-Z0-9]{7}"));
      assertEquals(Boolean.TRUE, a.getI9Appointment());
      assertNotNull(a.getBsMsStudent());
      assertNotNull(a.getOtherCampusJob());
      assertNotNull(a.getPriorUcsbEmployment());
      assertNotNull(a.getChangingMajor());
      assertNotNull(a.getPrevExperience());
      assertNotNull(a.getComments());
      assertNotNull(a.getAvailabilityCommentsFirstChoice());
      assertNull(a.getAvailabilityCommentsSecondChoice());
      assertNull(a.getResidencyStatus());
      assertNull(a.getClassLevel());
      assertNull(a.getLanguageExam());
      assertTrue(
          a.getTopicProficiencies().keySet().stream().allMatch(Set.of("Git", "SQL")::contains));
      assertTrue(a.getTopicProficiencies().values().stream().allMatch(v -> v >= 1 && v <= 3));
      assertTrue(
          a.getInterests().keySet().stream().allMatch(Set.of("Grading", "Office hours")::contains));
      assertTrue(a.getInterests().values().stream().allMatch(v -> v >= 1 && v <= 5));
      sawLecture1 |= a.isAvailableForLecturesFirstChoice();
      sawLecture2 |= a.isAvailableForLecturesSecondChoice();
      sawDiscussion1 |= a.isAvailableForDiscussionFirstChoice();
      sawDiscussion2 |= a.isAvailableForDiscussionSecondChoice();

      // 6(n-1) + 1..6 courses for a student in year n, ending in the quarter of TODAY.
      int courses = a.getPriorCoursework().size();
      assertTrue(
          courses >= 6 * (year - 1) + 1 && courses <= 6 * (year - 1) + 6, year + ": " + courses);
      assertTrue(a.getPriorCoursework().stream().allMatch(PriorCoursework::isUcsbCourse));
      assertEquals("W26", a.getPriorCoursework().get(courses - 1).getTerm());

      int previous = a.getPreviousServiceAsUla();
      assertTrue(previous >= 0 && previous <= (year == 1 ? 0 : Math.min(6, 3 * (year - 1))));
      if (previous == 0) {
        assertNotNull(a.getTrainingCommitment());
        commitments.add(a.getTrainingCommitment());
        assertTrue(a.getVideoLink().startsWith("https://example.com/fake-video/"));
        assertEquals(
            a.getTrainingCommitment() != TrainingCommitment.AGREE,
            a.getTrainingCommitmentExplanation() != null);
      } else {
        assertNull(a.getTrainingCommitment());
        assertNull(a.getTrainingCommitmentExplanation());
        assertNull(a.getVideoLink());
      }

      if (a.getBsMsStudent()) {
        sawBsMs = true;
        assertNotNull(a.getStudentStatusNextQuarter());
        assertNotNull(a.getWantsTaEligibility());
      } else {
        assertNull(a.getStudentStatusNextQuarter());
        assertNull(a.getWantsTaEligibility());
      }
      if (a.getPriorUcsbEmployment()) {
        sawEmployed = true;
        assertTrue(a.getEmployeeId().matches("\\d{8}"));
      } else {
        assertNull(a.getEmployeeId());
      }
      sawChanging |= a.getChangingMajor();
    }

    assertEquals(Set.of(1, 2, 3, 4), years);
    assertEquals(
        Set.of(TrainingCommitment.AGREE, TrainingCommitment.UNSURE, TrainingCommitment.CANNOT),
        commitments);
    assertTrue(sawBsMs && sawEmployed && sawChanging);
    assertTrue(sawLecture1 && sawLecture2 && sawDiscussion1 && sawDiscussion2);
    assertTrue(firstQuarter > 20 && firstQuarter < 250, "first quarter " + firstQuarter);
  }

  @Test
  public void terms_are_counted_back_from_the_quarter_of_the_date_given() {
    withSettings();
    List<Application> autumn =
        generator.generate(
            recruitment(RecruitmentType.ULA),
            COURSES,
            50,
            FakeCoverage.ALL,
            new Random(3),
            new HashSet<>(),
            LocalDate.of(2027, 10, 5));

    for (Application a : autumn) {
      List<PriorCoursework> prior = a.getPriorCoursework();
      assertEquals("F27", prior.get(prior.size() - 1).getTerm());
    }
  }

  // ---- missing settings ----

  @Test
  public void with_no_settings_lists_there_are_no_topics_and_the_major_is_computer_science() {
    when(taTopics.findAll()).thenReturn(List.of());
    when(taMajors.findAll()).thenReturn(List.of());
    when(ulaTopics.findAll()).thenReturn(List.of());
    when(ulaMajors.findAll()).thenReturn(List.of());
    when(ulaInterests.findAll()).thenReturn(List.of());

    for (RecruitmentType type : RecruitmentType.values()) {
      for (Application a : generate(type, 20, FakeCoverage.ALL)) {
        assertEquals("Computer Science", a.getMajor());
        assertTrue(a.getTopicProficiencies().isEmpty());
        assertTrue(a.getInterests().isEmpty());
      }
    }
  }

  // ---- course choices, through the generator ----

  private static Set<String> mentioned(Application a) {
    Set<String> mentioned = new HashSet<>(a.getCourseInterests().keySet());
    mentioned.add(a.getFirstChoiceCourse());
    mentioned.add(a.getSecondChoiceCourse());
    mentioned.remove(null);
    return mentioned;
  }

  @Test
  public void with_all_coverage_every_course_has_an_applicant() {
    withSettings();
    List<Application> applications = generate(RecruitmentType.TA, 12, FakeCoverage.ALL);

    Set<String> all = new HashSet<>();
    applications.forEach(a -> all.addAll(mentioned(a)));
    assertEquals(new HashSet<>(COURSES), all);
    for (int i = 0; i < COURSES.size(); i++) {
      assertEquals(COURSES.get(i), applications.get(i).getFirstChoiceCourse());
    }
  }

  @Test
  public void with_sparse_coverage_one_course_has_nobody_and_one_has_three() {
    withSettings();
    List<Application> applications = generate(RecruitmentType.ULA, 60, FakeCoverage.SPARSE);

    Map<String, Long> counts =
        COURSES.stream()
            .collect(
                Collectors.toMap(
                    c -> c,
                    c -> applications.stream().filter(a -> mentioned(a).contains(c)).count()));
    assertEquals(1, counts.values().stream().filter(n -> n == 0).count());
    assertEquals(1, counts.values().stream().filter(n -> n == 3).count());
  }

  @Test
  public void a_single_course_has_no_second_choice_and_no_course_means_no_choices() {
    withSettings();
    for (Application a :
        generator.generate(
            recruitment(RecruitmentType.TA),
            List.of("CMPSC   16"),
            5,
            FakeCoverage.ALL,
            new Random(3),
            new HashSet<>(),
            TODAY)) {
      assertEquals("CMPSC   16", a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
    }
    for (Application a :
        generator.generate(
            recruitment(RecruitmentType.ULA),
            List.of(),
            5,
            FakeCoverage.SPARSE,
            new Random(3),
            new HashSet<>(),
            TODAY)) {
      assertNull(a.getFirstChoiceCourse());
      assertNull(a.getSecondChoiceCourse());
      assertTrue(a.getCourseInterests().isEmpty());
    }
  }

  // ---- the whole output, pinned ----

  /** A fingerprint of everything a seeded run makes, so any change to what is drawn shows up. */
  private int fingerprint(RecruitmentType type, FakeCoverage coverage) {
    return generate(type, 250, coverage, 42L, new HashSet<>()).toString().hashCode();
  }

  @Test
  public void a_seeded_run_makes_exactly_the_same_applications_every_time() {
    withSettings();

    assertEquals(
        List.of(-1378083815, -106656864, 1703775240, 2142202316),
        List.of(
            fingerprint(RecruitmentType.TA, FakeCoverage.ALL),
            fingerprint(RecruitmentType.TA, FakeCoverage.SPARSE),
            fingerprint(RecruitmentType.ULA, FakeCoverage.ALL),
            fingerprint(RecruitmentType.ULA, FakeCoverage.SPARSE)));
  }

  @Test
  public void the_order_the_settings_lists_come_back_in_does_not_matter() {
    withSettings();
    int forward = fingerprint(RecruitmentType.ULA, FakeCoverage.ALL);
    when(ulaTopics.findAll())
        .thenReturn(
            List.of(
                UlaTopic.builder().name("Git").build(), UlaTopic.builder().name("SQL").build()));
    when(ulaInterests.findAll())
        .thenReturn(
            List.of(
                UlaInterest.builder().name("Grading").build(),
                UlaInterest.builder().name("Office hours").build()));
    when(ulaMajors.findAll())
        .thenReturn(
            List.of(
                UlaMajor.builder().name("Chemistry").build(),
                UlaMajor.builder().name("Physics").build()));

    assertEquals(forward, fingerprint(RecruitmentType.ULA, FakeCoverage.ALL));
  }

  // ---- course titles (issue #262) ----

  @Test
  public void ucsb_courses_get_their_titles_from_the_course_table_and_others_keep_theirs() {
    withSettings();
    when(courses.findAll())
        .thenReturn(
            List.of(
                Course.builder().courseId("CMPSC 8").title("Intro to Computer Science").build(),
                Course.builder().courseId("CMPSC 16").title("Problem Solving II").build(),
                Course.builder().courseId("CMPSC 24").title("Problem Solving III").build(),
                Course.builder().courseId("CMPSC 32").title("Object Oriented Design").build(),
                Course.builder().courseId("CMPSC 40").title("   ").build(),
                Course.builder().courseId("CMPSC 64").title(null).build()));
    Set<String> titled = Set.of("CMPSC 8", "CMPSC 16", "CMPSC 24", "CMPSC 32");
    int ucsbRows = 0;
    int unknownRows = 0;
    for (RecruitmentType type : RecruitmentType.values()) {
      for (Application a : generate(type, 60, FakeCoverage.ALL)) {
        for (PriorCoursework c : a.getPriorCoursework()) {
          if (c.isUcsbCourse()) {
            if (titled.contains(c.getCourseNumber())) {
              ucsbRows++;
              assertNotNull(c.getCourseTitle());
              assertFalse(c.getCourseTitle().isBlank());
            } else {
              unknownRows++;
              assertNull(c.getCourseTitle());
            }
          } else {
            assertNotNull(c.getCourseTitle());
          }
        }
      }
    }
    assertTrue(ucsbRows > 0);
    assertTrue(unknownRows > 0);
  }

  @Test
  public void each_ucsb_title_is_exactly_the_one_the_table_has_for_that_course() {
    withSettings();
    when(courses.findAll())
        .thenReturn(
            List.of(
                Course.builder().courseId("CMPSC 8").title("Title of eight").build(),
                Course.builder().courseId("CMPSC 16").title("Title of sixteen").build(),
                Course.builder().courseId("CMPSC 24").title("Title of twenty-four").build()));
    Map<String, String> expected =
        Map.of(
            "CMPSC 8", "Title of eight",
            "CMPSC 16", "Title of sixteen",
            "CMPSC 24", "Title of twenty-four");
    int checked = 0;
    for (Application a : generate(RecruitmentType.ULA, 60, FakeCoverage.ALL)) {
      for (PriorCoursework c : a.getPriorCoursework()) {
        if (expected.containsKey(c.getCourseNumber())) {
          checked++;
          assertEquals(expected.get(c.getCourseNumber()), c.getCourseTitle());
        }
      }
    }
    assertTrue(checked > 0);
  }
}
