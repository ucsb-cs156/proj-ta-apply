package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
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

  private final FakeCoursework coursework = new FakeCoursework();
  private final TaTopicRepository taTopics = mock(TaTopicRepository.class);
  private final UlaTopicRepository ulaTopics = mock(UlaTopicRepository.class);
  private final UlaInterestRepository ulaInterests = mock(UlaInterestRepository.class);
  private final TaMajorRepository taMajors = mock(TaMajorRepository.class);
  private final UlaMajorRepository ulaMajors = mock(UlaMajorRepository.class);
  private final FakeApplicationGenerator generator =
      new FakeApplicationGenerator(
          coursework, taTopics, ulaTopics, ulaInterests, taMajors, ulaMajors);

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
    return generator.generate(recruitment(type), COURSES, count, coverage, new Random(seed), taken);
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

  @Test
  public void ta_applications_carry_every_answer_the_form_requires() {
    withSettings();
    Set<String> international = schools(true);
    Set<String> domestic = schools(false);
    Set<ResidencyStatus> residencies = new HashSet<>();
    Set<ClassLevel> levels = new HashSet<>();
    int ucsbPaths = 0;
    int otherPaths = 0;

    for (Application a : generate(RecruitmentType.TA, 600, FakeCoverage.ALL)) {
      residencies.add(a.getResidencyStatus());
      levels.add(a.getClassLevel());
      assertNotNull(a.getMajor());
      assertTrue(Set.of("Applied Math", "Statistics").contains(a.getMajor()));
      assertTrue(a.getGpaMajor() >= 3.0 && a.getGpaMajor() <= 4.0);
      assertTrue(a.getGpaOverall() >= 3.0 && a.getGpaOverall() <= 4.0);
      assertEquals(a.getGpaMajor(), Math.round(a.getGpaMajor() * 100) / 100.0);
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

      List<PriorCoursework> prior = a.getPriorCoursework();
      List<PriorCoursework> graduate = prior.subList(prior.size() - 5, prior.size());
      List<PriorCoursework> undergraduate = prior.subList(0, prior.size() - 5);
      assertTrue(
          graduate.stream()
              .allMatch(
                  c -> c.isUcsbCourse() && c.getCourseNumber().matches("CMPSC [2-9]\\d\\d.*")));
      boolean international_ =
          a.getResidencyStatus() == ResidencyStatus.F1_STUDENT_VISA
              || a.getResidencyStatus() == ResidencyStatus.J1_STUDENT_VISA;
      if (undergraduate.get(0).isUcsbCourse()) {
        ucsbPaths++;
        assertTrue(undergraduate.size() >= 8 && undergraduate.size() <= 14);
        assertTrue(undergraduate.stream().allMatch(PriorCoursework::isUcsbCourse));
      } else {
        otherPaths++;
        assertEquals(10, undergraduate.size());
        assertTrue(undergraduate.stream().noneMatch(PriorCoursework::isUcsbCourse));
        assertTrue(
            undergraduate.stream()
                .allMatch(
                    c -> (international_ ? international : domestic).contains(c.getOtherSchool())));
      }
    }

    // Residency is spread evenly over four values, never OTHER; both class levels and both paths
    // occur.
    assertEquals(
        Set.of(
            ResidencyStatus.US_CITIZEN,
            ResidencyStatus.US_RESIDENT,
            ResidencyStatus.F1_STUDENT_VISA,
            ResidencyStatus.J1_STUDENT_VISA),
        residencies);
    assertEquals(Set.of(ClassLevel.PHD, ClassLevel.MS), levels);
    assertTrue(ucsbPaths > 200 && otherPaths > 200, ucsbPaths + " vs " + otherPaths);
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

  private Set<String> schools(boolean international) {
    return coursework.other(new Random(9), 1000, international, 20261).stream()
        .map(PriorCoursework::getOtherSchool)
        .collect(Collectors.toSet());
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

    for (Application a : generate(RecruitmentType.ULA, 1500, FakeCoverage.ALL)) {
      int year = Integer.parseInt(a.getYearInProgram().substring(0, 1));
      years.add(year);
      assertEquals("S" + String.format("%02d", 26 + 4 - year), a.getGraduationDate());
      assertTrue(Set.of("Physics", "Chemistry").contains(a.getMajor()));
      assertTrue(a.getGpaMajor() >= 2.7 && a.getGpaMajor() <= 4.0);
      assertTrue(a.getGpaOverall() >= 2.7 && a.getGpaOverall() <= 4.0);
      assertTrue(a.getPermNumber().matches("[A-Z0-9]{7}"));
      assertEquals(Boolean.TRUE, a.getI9Appointment());
      assertNotNull(a.getBsMsStudent());
      assertNotNull(a.getOtherCampusJob());
      assertNotNull(a.getPriorUcsbEmployment());
      assertNotNull(a.getChangingMajor());
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

      // Six courses a year: year n has between 6(n-1)+1 and 6(n-1)+6 of them behind it.
      int courses = a.getPriorCoursework().size();
      assertTrue(
          courses >= 6 * (year - 1) + 1 && courses <= 6 * (year - 1) + 6, year + ": " + courses);
      assertTrue(a.getPriorCoursework().stream().allMatch(PriorCoursework::isUcsbCourse));

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

  // ---- choices and coverage ----

  @Test
  public void with_all_coverage_every_course_is_someone_s_first_and_second_choice() {
    withSettings();
    List<Application> applications = generate(RecruitmentType.TA, 60, FakeCoverage.ALL);

    assertEquals(
        new HashSet<>(COURSES),
        applications.stream().map(Application::getFirstChoiceCourse).collect(Collectors.toSet()));
    assertEquals(
        new HashSet<>(COURSES),
        applications.stream().map(Application::getSecondChoiceCourse).collect(Collectors.toSet()));
    for (int i = 0; i < applications.size(); i++) {
      Application a = applications.get(i);
      assertEquals(COURSES.get(i % COURSES.size()), a.getFirstChoiceCourse());
      assertTrue(COURSES.contains(a.getSecondChoiceCourse()));
      assertFalse(a.getFirstChoiceCourse().equals(a.getSecondChoiceCourse()));
      assertFalse(a.getCourseInterests().containsKey(a.getFirstChoiceCourse()));
      assertFalse(a.getCourseInterests().containsKey(a.getSecondChoiceCourse()));
      assertTrue(COURSES.containsAll(a.getCourseInterests().keySet()));
      assertFalse(a.getCourseInterests().containsValue(CourseInterest.NOT_INTERESTED));
    }
  }

  @Test
  public void other_courses_are_enthusiastic_twenty_percent_and_would_consider_forty_percent() {
    withSettings();
    List<Application> applications = generate(RecruitmentType.TA, 5000, FakeCoverage.ALL);

    long others = applications.size() * (COURSES.size() - 2L);
    long enthusiastic = count(applications, CourseInterest.ENTHUSIASTIC);
    long wouldConsider = count(applications, CourseInterest.WOULD_CONSIDER);

    assertEquals(0.2, enthusiastic / (double) others, 0.02);
    assertEquals(0.4, wouldConsider / (double) others, 0.02);
  }

  private static long count(List<Application> applications, CourseInterest interest) {
    return applications.stream()
        .flatMap(a -> a.getCourseInterests().values().stream())
        .filter(interest::equals)
        .count();
  }

  @Test
  public void with_sparse_coverage_interest_is_confined_to_a_few_courses() {
    withSettings();
    List<Application> applications = generate(RecruitmentType.TA, 300, FakeCoverage.SPARSE);

    Set<String> used = new HashSet<>();
    for (Application a : applications) {
      used.add(a.getFirstChoiceCourse());
      used.add(a.getSecondChoiceCourse());
      used.addAll(a.getCourseInterests().keySet());
      assertFalse(a.getFirstChoiceCourse().equals(a.getSecondChoiceCourse()));
    }
    // Two fifths of six courses, rounded down, but never fewer than two.
    assertEquals(2, used.size());
  }

  @Test
  public void the_covered_courses_are_all_for_all_and_a_random_two_fifths_for_sparse() {
    List<String> ten = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");

    assertEquals(
        ten, FakeApplicationGenerator.coveredCourses(ten, FakeCoverage.ALL, new Random(1)));
    List<String> sparse =
        FakeApplicationGenerator.coveredCourses(ten, FakeCoverage.SPARSE, new Random(1));
    assertEquals(4, sparse.size());
    assertTrue(ten.containsAll(sparse));
    assertEquals(sparse.size(), new HashSet<>(sparse).size());
    assertEquals(
        2,
        FakeApplicationGenerator.coveredCourses(
                ten.subList(0, 3), FakeCoverage.SPARSE, new Random(1))
            .size());
    assertEquals(
        1,
        FakeApplicationGenerator.coveredCourses(
                ten.subList(0, 1), FakeCoverage.SPARSE, new Random(1))
            .size());
    assertEquals(
        0,
        FakeApplicationGenerator.coveredCourses(List.of(), FakeCoverage.SPARSE, new Random(1))
            .size());
    // The caller's list is never reordered.
    assertEquals(List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j"), ten);
  }

  @Test
  public void a_single_course_has_no_second_choice() {
    withSettings();
    for (FakeCoverage coverage : FakeCoverage.values()) {
      for (Application a :
          generator.generate(
              recruitment(RecruitmentType.TA),
              List.of("CMPSC   16"),
              5,
              coverage,
              new Random(3),
              new HashSet<>())) {
        assertEquals("CMPSC   16", a.getFirstChoiceCourse());
        assertNull(a.getSecondChoiceCourse());
        assertTrue(a.getCourseInterests().isEmpty());
      }
    }
  }

  @Test
  public void with_no_courses_there_are_no_choices() {
    withSettings();
    for (Application a :
        generator.generate(
            recruitment(RecruitmentType.ULA),
            List.of(),
            5,
            FakeCoverage.ALL,
            new Random(3),
            new HashSet<>())) {
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
        List.of(-1208047388, 1004929938, 1229452468, 1224238510),
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
  public void sparse_coverage_picks_different_courses_for_different_seeds() {
    List<String> ten = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");
    Set<List<String>> subsets = new HashSet<>();
    for (long seed = 0; seed < 50; seed++) {
      subsets.add(
          FakeApplicationGenerator.coveredCourses(
              ten, FakeCoverage.SPARSE, new Random(seed * 1_000_003L)));
    }
    assertTrue(subsets.size() > 10);
  }
}
