package edu.ucsb.cs.taapply.services.fake;

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
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.utilities.CourseMatching;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Builds fake applications for Developer Mode (issue #219). Each one satisfies every rule a real
 * application is held to (the required answers of issues #213 and #214, and enough prior
 * coursework), so it can travel the whole path from review to hiring decisions. All randomness
 * comes from the {@link Random} passed in, so a seeded generator gives the same applications every
 * time.
 *
 * <p>Coursework terms run back from the quarter {@code today} falls in, the latest course taking
 * that quarter. Graduation is counted from the recruitment's own year.
 */
@Service
public class FakeApplicationGenerator {

  static final List<String> TA_RESIDENCY_EXAM_PASS_QUARTERS = List.of("F23", "W24", "S24", "F24");

  /**
   * Issue #448: how often, in percent, a fake ULA applicant has taken at UCSB a course they ask
   * for. The rest of the time they explain in their comments why they are prepared anyway.
   */
  static final int ASKED_FOR_TAKEN_PERCENT = 80;

  private final FakeCoursework coursework;
  private final CourseRepository courseRepository;
  private final TaTopicRepository taTopicRepository;
  private final UlaTopicRepository ulaTopicRepository;
  private final UlaInterestRepository ulaInterestRepository;
  private final TaMajorRepository taMajorRepository;
  private final UlaMajorRepository ulaMajorRepository;
  private final FakeExplanationService explanations;

  @Autowired
  public FakeApplicationGenerator(
      FakeCoursework coursework,
      CourseRepository courseRepository,
      TaTopicRepository taTopicRepository,
      UlaTopicRepository ulaTopicRepository,
      UlaInterestRepository ulaInterestRepository,
      TaMajorRepository taMajorRepository,
      UlaMajorRepository ulaMajorRepository,
      FakeExplanationService explanations) {
    this.coursework = coursework;
    this.courseRepository = courseRepository;
    this.taTopicRepository = taTopicRepository;
    this.ulaTopicRepository = ulaTopicRepository;
    this.ulaInterestRepository = ulaInterestRepository;
    this.taMajorRepository = taMajorRepository;
    this.ulaMajorRepository = ulaMajorRepository;
    this.explanations = explanations;
  }

  /**
   * {@code count} fake applications to {@code recruitment}, none sharing an email with {@code
   * takenEmails}, which gains the new ones.
   *
   * @param courseIds the distinct course ids on offer, exactly as an applicant would choose them
   * @param today the date the applications are made, which fixes the terms of their coursework
   */
  public List<Application> generate(
      Recruitment recruitment,
      List<String> courseIds,
      int count,
      FakeCoverage coverage,
      Random random,
      Set<String> takenEmails,
      LocalDate today) {
    List<String> topics = topicNames(recruitment.getType());
    List<String> majors = majorNames(recruitment.getType());
    List<String> interests = new ArrayList<>();
    if (recruitment.getType() == RecruitmentType.ULA) {
      ulaInterestRepository.findAll().forEach((UlaInterest i) -> interests.add(i.getName()));
      Collections.sort(interests);
    }
    int latest = FakeCoursework.latestQuarter(today);
    Map<String, String> titles = courseTitles();

    List<Application> applications = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      Application application =
          recruitment.getType() == RecruitmentType.ULA
              ? ula(recruitment, random, topics, majors, interests, latest)
              : ta(recruitment, random, topics, majors, latest);
      identity(application, recruitment, random, takenEmails);
      applications.add(application);
    }
    FakeCourseChoices.assign(applications, courseIds, coverage, random);
    for (Application application : applications) {
      if (recruitment.getType() == RecruitmentType.ULA) {
        takeOrExplain(application, random, latest);
      }
      addTitles(application, titles);
    }
    return applications;
  }

  /** The title of every course in the course table, by normalized course id ("CMPSC 156"). */
  private Map<String, String> courseTitles() {
    Map<String, String> titles = new HashMap<>();
    for (Course course : courseRepository.findAll()) {
      if (course.getTitle() != null && !course.getTitle().isBlank()) {
        titles.put(course.getCourseId(), course.getTitle());
      }
    }
    return titles;
  }

  /**
   * Fills in the title of each UCSB course on the transcript from the course table, as a real
   * applicant's bulk-add does (issue #262). A course the table does not have keeps no title.
   */
  private static void addTitles(Application application, Map<String, String> titles) {
    for (PriorCoursework course : application.getPriorCoursework()) {
      if (course.isUcsbCourse()) {
        course.setCourseTitle(titles.get(course.getCourseNumber()));
      }
    }
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
      Recruitment recruitment,
      Random random,
      List<String> topics,
      List<String> majors,
      int latest) {
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

    // Undergraduate preparation. A US citizen or resident flips a coin between UCSB, where the
    // courses are those of a fourth-year ULA, and one other school; a visa holder always comes from
    // one international school. Then five graduate courses at UCSB.
    List<PriorCoursework> prior = new ArrayList<>();
    if (!international && random.nextBoolean()) {
      prior.addAll(coursework.ucsb(random, 6 * 3 + random.nextInt(1, 7), latest));
    } else {
      prior.addAll(coursework.other(random, 10, international, latest));
    }
    prior.addAll(coursework.ucsbGraduate(random, 5, latest));

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
    // Issue #292: now and then a first-year grad student is in their first quarter, with no GPAs.
    if (year == 1 && random.nextInt(4) == 0) {
      application.setFirstQuarter(true);
      application.setGpaMajor(null);
      application.setGpaOverall(null);
    }
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
      List<String> interests,
      int latest) {
    int year = random.nextInt(1, 5);
    // Six courses a year, so a later-year student has a longer path behind them.
    int wanted = 6 * (year - 1) + random.nextInt(1, 7);
    List<PriorCoursework> prior = coursework.ucsb(random, wanted, latest);

    int previousService = year == 1 ? 0 : random.nextInt(0, Math.min(6, 3 * (year - 1)) + 1);
    boolean employed = random.nextInt(4) == 0;
    boolean bsMs = random.nextInt(7) == 0;

    Application application = Application.builder().build();
    application.setYearInProgram(ordinal(year));
    application.setGraduationDate(graduation(recruitmentYear(recruitment) + 4 - year));
    application.setMajor(FakeNames.pick(majors, random));
    application.setGpaMajor(gpa(random, 2.7));
    application.setGpaOverall(gpa(random, 2.7));
    // Issue #292: now and then a first-year student is in their first quarter, with no GPAs.
    if (year == 1 && random.nextInt(4) == 0) {
      application.setFirstQuarter(true);
      application.setGpaMajor(null);
      application.setGpaOverall(null);
    }
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

  /**
   * The courses a ULA applicant asks for, in a fixed order: first choice, second choice, then the
   * courses they are Enthusiastic about or Would Consider, by course id.
   */
  static List<String> askedFor(Application application) {
    Set<String> asked = new LinkedHashSet<>();
    if (application.getFirstChoiceCourse() != null) {
      asked.add(application.getFirstChoiceCourse());
    }
    if (application.getSecondChoiceCourse() != null) {
      asked.add(application.getSecondChoiceCourse());
    }
    new TreeMap<>(application.getCourseInterests())
        .forEach(
            (courseId, interest) -> {
              if (interest == CourseInterest.ENTHUSIASTIC
                  || interest == CourseInterest.WOULD_CONSIDER) {
                asked.add(courseId);
              }
            });
    return new ArrayList<>(asked);
  }

  /**
   * Issue #448: for each course a ULA applicant asks for, a biased coin. Most of the time ({@link
   * #ASKED_FOR_TAKEN_PERCENT}) they have taken it at UCSB, and it is added to their transcript, in
   * term order, if the prerequisite walk did not already put it there. Otherwise it is taken off
   * their UCSB transcript, and their comments gain a sentence from {@link FakeExplanationService}
   * on why they are prepared anyway, one line per such course. A transcript left empty gains one
   * course from another school, since a ULA application needs at least one.
   */
  void takeOrExplain(Application application, Random random, int latest) {
    List<PriorCoursework> prior = new ArrayList<>(application.getPriorCoursework());
    List<String> lines = new ArrayList<>();
    for (String courseId : askedFor(application)) {
      if (random.nextInt(100) < ASKED_FOR_TAKEN_PERCENT) {
        if (CourseMatching.firstUcsbCourse(prior, courseId) == null) {
          FakeCoursework.insertInTermOrder(prior, coursework.ucsbCourse(random, courseId, latest));
        }
      } else {
        prior.removeIf(row -> CourseMatching.isUcsbCourse(row, courseId));
        lines.add(explanations.explanation(courseId, random));
      }
    }
    if (prior.isEmpty()) {
      prior.addAll(coursework.other(random, 1, false, latest));
    }
    application.setPriorCoursework(prior);
    if (!lines.isEmpty()) {
      lines.add(0, application.getComments());
      application.setComments(String.join("\n", lines));
    }
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
