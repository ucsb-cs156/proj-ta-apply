package edu.ucsb.cs.taapply.services.fake;

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
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Builds fake applications for Developer Mode (issue #219). Each one satisfies every rule a real
 * application is held to (the required answers of issues #213 and #214, and enough prior
 * coursework), so it can travel the whole path from review to hiring decisions. All randomness
 * comes from the {@link Random} passed in, so a seeded generator gives the same applications every
 * time.
 *
 * <p>The reference point for dates is the recruitment's own quarter: coursework ends the quarter
 * before it, and graduation is counted from its year.
 */
@Service
public class FakeApplicationGenerator {

  static final List<String> TA_RESIDENCY_EXAM_PASS_QUARTERS = List.of("F23", "W24", "S24", "F24");

  private final FakeCoursework coursework;
  private final TaTopicRepository taTopicRepository;
  private final UlaTopicRepository ulaTopicRepository;
  private final UlaInterestRepository ulaInterestRepository;
  private final TaMajorRepository taMajorRepository;
  private final UlaMajorRepository ulaMajorRepository;

  @Autowired
  public FakeApplicationGenerator(
      FakeCoursework coursework,
      TaTopicRepository taTopicRepository,
      UlaTopicRepository ulaTopicRepository,
      UlaInterestRepository ulaInterestRepository,
      TaMajorRepository taMajorRepository,
      UlaMajorRepository ulaMajorRepository) {
    this.coursework = coursework;
    this.taTopicRepository = taTopicRepository;
    this.ulaTopicRepository = ulaTopicRepository;
    this.ulaInterestRepository = ulaInterestRepository;
    this.taMajorRepository = taMajorRepository;
    this.ulaMajorRepository = ulaMajorRepository;
  }

  /**
   * {@code count} fake applications to {@code recruitment}, none sharing an email with {@code
   * takenEmails}, which gains the new ones.
   *
   * @param courseIds the distinct course ids on offer, exactly as an applicant would choose them
   */
  public List<Application> generate(
      Recruitment recruitment,
      List<String> courseIds,
      int count,
      FakeCoverage coverage,
      Random random,
      Set<String> takenEmails) {
    List<String> topics = topicNames(recruitment.getType());
    List<String> majors = majorNames(recruitment.getType());
    List<String> interests = new ArrayList<>();
    if (recruitment.getType() == RecruitmentType.ULA) {
      ulaInterestRepository.findAll().forEach((UlaInterest i) -> interests.add(i.getName()));
      Collections.sort(interests);
    }
    List<String> covered = coveredCourses(courseIds, coverage, random);

    List<Application> applications = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      Application application =
          recruitment.getType() == RecruitmentType.ULA
              ? ula(recruitment, random, topics, majors, interests)
              : ta(recruitment, random, topics, majors);
      identity(application, recruitment, random, takenEmails);
      choices(application, courseIds, covered, coverage, i, random);
      applications.add(application);
    }
    return applications;
  }

  private List<String> topicNames(RecruitmentType type) {
    List<String> names = new ArrayList<>();
    if (type == RecruitmentType.ULA) {
      ulaTopicRepository.findAll().forEach((UlaTopic t) -> names.add(t.getName()));
    } else {
      taTopicRepository.findAll().forEach((TaTopic t) -> names.add(t.getName()));
    }
    Collections.sort(names);
    return names;
  }

  private List<String> majorNames(RecruitmentType type) {
    List<String> names = new ArrayList<>();
    if (type == RecruitmentType.ULA) {
      ulaMajorRepository.findAll().forEach((UlaMajor m) -> names.add(m.getName()));
    } else {
      taMajorRepository.findAll().forEach((TaMajor m) -> names.add(m.getName()));
    }
    Collections.sort(names);
    return names.isEmpty() ? List.of("Computer Science") : names;
  }

  /** Every course for ALL; for SPARSE, a random two-fifths (at least two) that attract interest. */
  static List<String> coveredCourses(List<String> courseIds, FakeCoverage coverage, Random random) {
    if (coverage == FakeCoverage.ALL) {
      return courseIds;
    }
    List<String> shuffled = new ArrayList<>(courseIds);
    Collections.shuffle(shuffled, random);
    int keep = Math.min(courseIds.size(), Math.max(2, courseIds.size() * 2 / 5));
    return new ArrayList<>(shuffled.subList(0, keep));
  }

  // ---- identity ----

  private static void identity(
      Application application, Recruitment recruitment, Random random, Set<String> takenEmails) {
    String first = FakeNames.pick(FakeNames.FIRST, random);
    String last = FakeNames.pick(FakeNames.LAST, random);
    String base = (first + "." + last).toLowerCase();
    String email = base + "@" + FakeNames.EMAIL_DOMAIN;
    for (int suffix = 2; takenEmails.contains(email); suffix++) {
      email = base + suffix + "@" + FakeNames.EMAIL_DOMAIN;
    }
    takenEmails.add(email);
    application.setRecruitmentId(recruitment.getId());
    application.setOrigin(ApplicationOrigin.DEVELOPER_MODE);
    application.setEmail(email);
    application.setFirstName(first);
    application.setMiddleName(FakeNames.MIDDLE);
    application.setLastName(last);
  }

  // ---- course choices and interests ----

  /**
   * First and second choice and the other interests. With ALL coverage the first choice runs round
   * the course list in turn and the second is some other course, so every course is somebody's
   * first choice. With SPARSE both come from the few covered courses. Every other covered course is
   * enthusiastic 20 percent of the time, would-consider 40 percent, and not interesting (so not
   * stored) 40 percent.
   */
  private static void choices(
      Application application,
      List<String> courseIds,
      List<String> covered,
      FakeCoverage coverage,
      int index,
      Random random) {
    if (courseIds.isEmpty()) {
      return;
    }
    String first =
        coverage == FakeCoverage.ALL
            ? courseIds.get(index % courseIds.size())
            : covered.get(random.nextInt(covered.size()));
    List<String> others = new ArrayList<>(covered);
    others.remove(first);
    String second = others.isEmpty() ? null : others.get(random.nextInt(others.size()));
    application.setFirstChoiceCourse(first);
    application.setSecondChoiceCourse(second);
    Map<String, CourseInterest> interests = new HashMap<>();
    for (String course : covered) {
      if (course.equals(first) || course.equals(second)) {
        continue;
      }
      int roll = random.nextInt(10);
      if (roll < 2) {
        interests.put(course, CourseInterest.ENTHUSIASTIC);
      } else if (roll < 6) {
        interests.put(course, CourseInterest.WOULD_CONSIDER);
      }
    }
    application.setCourseInterests(interests);
  }

  // ---- shared pieces ----

  private static double gpa(Random random, double low) {
    return Math.round((low + random.nextDouble() * (4.0 - low)) * 100) / 100.0;
  }

  private static String ordinal(int n) {
    return switch (n) {
      case 1 -> "1st";
      case 2 -> "2nd";
      case 3 -> "3rd";
      default -> n + "th";
    };
  }

  private static String graduation(int year) {
    return "S" + String.format("%02d", year % 100);
  }

  private static int recruitmentYear(Recruitment recruitment) {
    return Integer.parseInt(recruitment.getQuarter()) / 10;
  }

  private static Map<String, Integer> ratings(
      List<String> names, int maxRating, Random random, int percent) {
    Map<String, Integer> ratings = new HashMap<>();
    for (String name : names) {
      if (random.nextInt(100) < percent) {
        ratings.put(name, random.nextInt(1, maxRating + 1));
      }
    }
    return ratings;
  }

  // ---- TA ----

  private Application ta(
      Recruitment recruitment, Random random, List<String> topics, List<String> majors) {
    int reference = Integer.parseInt(recruitment.getQuarter());
    ClassLevel level = random.nextBoolean() ? ClassLevel.PHD : ClassLevel.MS;
    int year = random.nextInt(1, level == ClassLevel.PHD ? 6 : 3);
    ResidencyStatus residency =
        List.of(
                ResidencyStatus.US_CITIZEN,
                ResidencyStatus.US_RESIDENT,
                ResidencyStatus.F1_STUDENT_VISA,
                ResidencyStatus.J1_STUDENT_VISA)
            .get(random.nextInt(4));
    boolean international =
        residency == ResidencyStatus.F1_STUDENT_VISA
            || residency == ResidencyStatus.J1_STUDENT_VISA;
    LanguageExamStatus exam =
        switch (residency) {
          case US_CITIZEN -> LanguageExamStatus.EXEMPT_US_CITIZEN;
          case US_RESIDENT -> LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT;
          default -> LanguageExamStatus.PASSED_F1_OR_J1_VISA;
        };

    // Undergraduate preparation: either at UCSB or at one other school, then graduate courses.
    List<PriorCoursework> prior = new ArrayList<>();
    if (random.nextBoolean()) {
      prior.addAll(coursework.ucsb(random, random.nextInt(8, 15), reference));
    } else {
      prior.addAll(coursework.other(random, 10, international, reference));
    }
    prior.addAll(coursework.ucsbGraduate(random, 5, reference));

    Application application = Application.builder().build();
    application.setClassLevel(level);
    application.setYearInProgram(ordinal(year));
    application.setGraduationDate(
        graduation(
            Math.max(
                recruitmentYear(recruitment),
                recruitmentYear(recruitment) + (level == ClassLevel.PHD ? 5 : 2) - year)));
    application.setResidencyStatus(residency);
    application.setLanguageExam(exam);
    if (exam != LanguageExamStatus.EXEMPT_US_CITIZEN) {
      application.setLanguageExamDatePassed(
          FakeNames.pick(TA_RESIDENCY_EXAM_PASS_QUARTERS, random));
    }
    application.setMajor(FakeNames.pick(majors, random));
    application.setGpaMajor(gpa(random, 3.0));
    application.setGpaOverall(gpa(random, 3.0));
    application.setPriorCoursework(prior);
    application.setTopicProficiencies(ratings(topics, 5, random, 50));
    application.setPrevExperience(FakeNames.pick(FakeNames.EXPERIENCE, random));
    application.setComments(FakeNames.pick(FakeNames.COMMENTS, random));
    return application;
  }

  // ---- ULA ----

  private Application ula(
      Recruitment recruitment,
      Random random,
      List<String> topics,
      List<String> majors,
      List<String> interests) {
    int reference = Integer.parseInt(recruitment.getQuarter());
    int year = random.nextInt(1, 5);
    // Six courses a year, so a later-year student has a longer path behind them.
    int wanted = 6 * (year - 1) + random.nextInt(1, 7);
    List<PriorCoursework> prior = coursework.ucsb(random, wanted, reference);

    int previousService = year == 1 ? 0 : random.nextInt(0, Math.min(6, 3 * (year - 1)) + 1);
    boolean employed = random.nextInt(4) == 0;
    boolean bsMs = random.nextInt(7) == 0;

    Application application = Application.builder().build();
    application.setYearInProgram(ordinal(year));
    application.setGraduationDate(graduation(recruitmentYear(recruitment) + 4 - year));
    application.setMajor(FakeNames.pick(majors, random));
    application.setGpaMajor(gpa(random, 2.7));
    application.setGpaOverall(gpa(random, 2.7));
    application.setPriorCoursework(prior);
    application.setTopicProficiencies(ratings(topics, 3, random, 50));
    application.setInterests(ratings(interests, 5, random, 60));
    application.setPrevExperience(FakeNames.pick(FakeNames.EXPERIENCE, random));
    application.setComments(FakeNames.pick(FakeNames.COMMENTS, random));
    application.setAvailableForLecturesFirstChoice(random.nextBoolean());
    application.setAvailableForLecturesSecondChoice(random.nextBoolean());
    application.setAvailableForDiscussionFirstChoice(random.nextBoolean());
    application.setAvailableForDiscussionSecondChoice(random.nextBoolean());
    application.setAvailabilityCommentsFirstChoice(FakeNames.pick(FakeNames.AVAILABILITY, random));
    application.setPermNumber(permNumber(random));
    application.setBsMsStudent(bsMs);
    if (bsMs) {
      application.setStudentStatusNextQuarter(
          random.nextBoolean() ? StudentStatus.UNDERGRADUATE : StudentStatus.GRADUATE);
      application.setWantsTaEligibility(random.nextBoolean());
    }
    application.setOtherCampusJob(
        List.of(OtherCampusJob.YES, OtherCampusJob.NO, OtherCampusJob.NOT_SURE)
            .get(random.nextInt(3)));
    application.setPriorUcsbEmployment(employed);
    if (employed) {
      application.setEmployeeId(String.format("%08d", random.nextInt(100_000_000)));
    }
    application.setI9Appointment(true);
    application.setPreviousServiceAsUla(previousService);
    if (previousService == 0) {
      boolean agrees = random.nextInt(5) != 0;
      application.setTrainingCommitment(
          agrees
              ? TrainingCommitment.AGREE
              : random.nextBoolean() ? TrainingCommitment.UNSURE : TrainingCommitment.CANNOT);
      if (!agrees) {
        application.setTrainingCommitmentExplanation(
            FakeNames.pick(FakeNames.EXPLANATIONS, random));
      }
      application.setVideoLink("https://example.com/fake-video/" + random.nextInt(100_000));
    }
    application.setChangingMajor(random.nextInt(6) == 0);
    return application;
  }

  private static String permNumber(Random random) {
    String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    StringBuilder perm = new StringBuilder();
    for (int i = 0; i < 7; i++) {
      perm.append(alphabet.charAt(random.nextInt(alphabet.length())));
    }
    return perm.toString();
  }
}
