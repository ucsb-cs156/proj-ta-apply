package edu.ucsb.cs.taapply.services;

import static edu.ucsb.cs.taapply.services.LegacyApplicationCsvService.blankToNull;
import static edu.ucsb.cs.taapply.services.LegacyApplicationCsvService.key;
import static edu.ucsb.cs.taapply.services.LegacyApplicationCsvService.numberOf;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.controller.ApplicationsController;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaTopic;
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
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Imports the ULA application Google Form's response sheet, downloaded as CSV, into a ULA
 * recruitment, one application per row, "as if" each student had entered it, so their next
 * application can be pre-filled from it (issue #70). The ULA counterpart of {@link
 * LegacyApplicationCsvService}.
 *
 * <p>Columns are found by the start of their header text (the form's question), so a reworded
 * question still matches, and the grids ({@code Course Preferences [24 (Mirza D)]}, {@code Rate
 * your familiarity with ... [Git/GitHub]}, {@code Activity Interests [...]}) by their bracketed
 * label. A familiarity topic or activity the ULA topics or interests list does not have is added to
 * the list, so the form shows the imported rating, and the result says what was added. The format
 * is the one in {@code docs/sample-data/legacy-ula-csv-example.csv}, with the original or the
 * condensed headers.
 */
@Service
@Slf4j
public class LegacyUlaApplicationCsvService {

  @Autowired private ApplicationRepository applicationRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired private UlaMajorRepository ulaMajorRepository;
  @Autowired private UlaTopicRepository ulaTopicRepository;
  @Autowired private UlaInterestRepository ulaInterestRepository;

  /** What an upload did, and what it added to the ULA topics and interests lists. */
  public static record ImportResult(
      int inserted,
      int alreadyPresent,
      int skipped,
      List<String> problems,
      List<String> addedTopics,
      List<String> addedInterests) {}

  // ---- the form's columns, by the start of their header
  // ------------------------------------------

  static final String TIMESTAMP = "Timestamp";
  static final String EMAIL = "Email Address";
  static final String FIRST_NAME = "First name";
  static final String LAST_NAME = "Last name";
  static final String PERM = "Perm number";
  static final String GRADUATION = "Expected graduation date";
  static final String BS_MS = "BS/MS student?";
  static final String STUDENT_STATUS = "Will you be in undergrad or graduate student status";
  static final String TA_ELIGIBILITY = "Do you want to be eligible for TA positions";
  static final String OTHER_JOB = "Other Campus Job?";
  static final String PRIOR_EMPLOYMENT = "Prior UCSB employment?";
  static final String EMPLOYEE_ID = "Employee ID number";
  static final String PREVIOUS_SERVICE = "Previous LA Service for CS";
  static final String[] TRAINING = {"Agree to statement", "IMPORTANT: Please READ"};
  static final String TRAINING_EXPLANATION = "If you indicated that you are UNSURE";
  static final String COURSE_PREFERENCE = "Course Preferences [";
  static final String FIRST_CHOICE = "First Choice";
  static final String SECOND_CHOICE = "Second Choice";
  static final String[] LECTURES_FIRST = {
    "Lectures: first choice", "Are you available to attend the lectures|[First choice course]"
  };
  static final String[] LECTURES_SECOND = {
    "Lectures: second choice", "Are you available to attend the lectures|[Second choice course]"
  };
  static final String[] SECTIONS_FIRST = {
    "Sections: first choice", "Are you available to attend at least one|[First choice course]"
  };
  static final String[] SECTIONS_SECOND = {
    "Sections: second choice", "Are you available to attend at least one|[Second choice course]"
  };
  static final String AVAILABILITY_COMMENTS = "Availability Comments";
  static final String GPA = "GPA";
  static final String MAJOR = "Major";
  static final String CHANGING_MAJOR = "Changing major?";
  static final String FAMILIARITY = "Rate your familiarity with";
  static final String ACTIVITY = "Activity Interests [";
  static final String VIDEO = "Video Link";

  public static final List<String> REQUIRED_COLUMNS = List.of(EMAIL, FIRST_NAME, LAST_NAME);

  static final String TA_ELIGIBILITY_YES = "Yes: so I will DEFINITELY";

  private static final Pattern BRACKETED = Pattern.compile("\\[(.*)\\]\\s*$");
  private static final Pattern LEADING_NUMBER = Pattern.compile("^\\s*(\\d+[A-Za-z]*)");

  // ---- the upload -----------------------------------------------------------------------------

  /**
   * Reads the sheet and saves one application per row into the recruitment.
   *
   * @throws ResponseStatusException 400 if the recruitment is not a ULA one, the file is empty, or
   *     a required column is missing
   */
  public ImportResult upload(MultipartFile file, Recruitment recruitment)
      throws IOException, CsvException {
    if (recruitment.getType() != RecruitmentType.ULA) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "The ULA form's responses can only be imported into a ULA recruitment");
    }
    Set<String> courseIds = new TreeSet<>();
    recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
        .filter(c -> !c.isRemoved())
        .forEach(c -> courseIds.add(c.getCourseId()));
    List<String> majors = names(ulaMajorRepository.findAll(), m -> m.getName());
    Set<String> knownTopics = new TreeSet<>(names(ulaTopicRepository.findAll(), t -> t.getName()));
    Set<String> knownInterests =
        new TreeSet<>(names(ulaInterestRepository.findAll(), i -> i.getName()));

    int inserted = 0;
    int alreadyPresent = 0;
    List<String> problems = new ArrayList<>();
    List<String> addedTopics = new ArrayList<>();
    List<String> addedInterests = new ArrayList<>();

    try (InputStream inputStream = new BufferedInputStream(file.getInputStream());
        InputStreamReader reader = new InputStreamReader(inputStream, StandardCharsets.UTF_8);
        CSVReader csvReader = new CSVReader(reader)) {

      String[] headers = csvReader.readNext();
      if (headers == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty");
      }
      Columns columns = new Columns(headers);

      String[] cells;
      int rowNumber = 1;
      while ((cells = csvReader.readNext()) != null) {
        rowNumber++;
        Row row = new Row(columns, cells);
        if (row.isBlank()) {
          continue;
        }
        String email = email(row.get(EMAIL));
        if (email == null) {
          problems.add("row %d: no usable email address".formatted(rowNumber));
          continue;
        }
        if (applicationRepository.existsByEmailAndRecruitmentId(email, recruitment.getId())) {
          alreadyPresent++;
          continue;
        }
        Application application =
            map(row, email, recruitment, courseIds, majors, knownTopics, knownInterests);
        for (String topic : application.getTopicProficiencies().keySet()) {
          if (knownTopics.add(topic)) {
            ulaTopicRepository.save(UlaTopic.builder().name(topic).build());
            addedTopics.add(topic);
          }
        }
        for (String interest : application.getInterests().keySet()) {
          if (knownInterests.add(interest)) {
            ulaInterestRepository.save(UlaInterest.builder().name(interest).build());
            addedInterests.add(interest);
          }
        }
        applicationRepository.save(application);
        inserted++;
      }
    }

    log.info(
        "ULA form CSV upload into recruitment {}: inserted={} alreadyPresent={} skipped={}"
            + " addedTopics={} addedInterests={}",
        recruitment.getId(),
        inserted,
        alreadyPresent,
        problems.size(),
        addedTopics,
        addedInterests);
    return new ImportResult(
        inserted, alreadyPresent, problems.size(), problems, addedTopics, addedInterests);
  }

  private static <T> List<String> names(
      Iterable<T> rows, java.util.function.Function<T, String> name) {
    return StreamSupport.stream(rows.spliterator(), false).map(name).toList();
  }

  /** The row's email in canonical form, or null when there is nothing usable. */
  static String email(String raw) {
    if (raw == null || raw.isBlank() || !raw.contains("@")) {
      return null;
    }
    return CanonicalFormConverter.convertToValidEmail(raw).strip();
  }

  // ---- the header -----------------------------------------------------------------------------

  /**
   * Where each question is in the file. A plain name matches a header that starts with it (after a
   * byte-order mark, if any); a name with {@code |} needs both parts, which tells the four
   * availability questions apart in their original long wording.
   */
  static final class Columns {
    final String[] headers;

    /** The bracketed label of each grid column, e.g. "Git/GitHub", keyed by column index. */
    final Map<Integer, String> labels = new HashMap<>();

    Columns(String[] rawHeaders) {
      headers = new String[rawHeaders.length];
      for (int i = 0; i < rawHeaders.length; i++) {
        headers[i] = rawHeaders[i].replace("﻿", "").strip();
        Matcher m = BRACKETED.matcher(headers[i]);
        if (m.find()) {
          labels.put(i, m.group(1).strip());
        }
      }
      List<String> missing = REQUIRED_COLUMNS.stream().filter(c -> find(c) < 0).toList();
      if (!missing.isEmpty()) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "CSV file is missing the column(s) %s".formatted(missing));
      }
    }

    int find(String... names) {
      for (String name : names) {
        String[] parts = name.split("\\|");
        for (int i = 0; i < headers.length; i++) {
          String h = headers[i].toLowerCase(Locale.ROOT);
          if (h.startsWith(parts[0].toLowerCase(Locale.ROOT))
              && (parts.length == 1 || h.contains(parts[1].toLowerCase(Locale.ROOT)))) {
            return i;
          }
        }
      }
      return -1;
    }

    /** The indexes of every column whose header starts with the name, in file order. */
    List<Integer> all(String name) {
      List<Integer> found = new ArrayList<>();
      for (int i = 0; i < headers.length; i++) {
        if (headers[i].toLowerCase(Locale.ROOT).startsWith(name.toLowerCase(Locale.ROOT))) {
          found.add(i);
        }
      }
      return found;
    }
  }

  /** One response, read by question; a short row reads blank in its missing cells. */
  static final class Row {
    final Columns columns;
    final String[] cells;

    Row(Columns columns, String[] cells) {
      this.columns = columns;
      this.cells = cells;
    }

    String at(int index) {
      return index < 0 || index >= cells.length ? "" : cells[index].strip();
    }

    String get(String... names) {
      return at(columns.find(names));
    }

    boolean isBlank() {
      for (String cell : cells) {
        if (!cell.isBlank()) {
          return false;
        }
      }
      return true;
    }
  }

  // ---- one row to one application -------------------------------------------------------------

  static Application map(
      Row row,
      String email,
      Recruitment recruitment,
      Set<String> courseIds,
      Collection<String> majors,
      Collection<String> topics,
      Collection<String> interests) {
    List<String> notes = new ArrayList<>();
    Map<String, CourseInterest> courseInterests = new LinkedHashMap<>();
    List<String> unmatched = new ArrayList<>();
    for (int i : row.columns.all(COURSE_PREFERENCE)) {
      String number = leadingNumber(row.columns.labels.getOrDefault(i, ""));
      CourseInterest interest = courseInterest(row.at(i));
      if (number == null || interest == null) {
        continue;
      }
      String courseId = courseByNumber(number, courseIds);
      if (courseId != null) {
        courseInterests.put(courseId, interest);
      } else {
        unmatched.add(LegacyApplicationCsvService.courseNumber(number));
      }
    }
    String first = choice(row.get(FIRST_CHOICE), courseIds, notes, "First choice");
    String second = choice(row.get(SECOND_CHOICE), courseIds, notes, "Second choice");
    courseInterests.remove(first);
    courseInterests.remove(second);
    if (!unmatched.isEmpty()) {
      notes.add("Also interested in: " + String.join(", ", unmatched));
    }

    String eligibility = row.get(TA_ELIGIBILITY);
    Boolean wantsTa = taEligibility(eligibility);
    if (wantsTa == null && !eligibility.isBlank()) {
      notes.add("About TA eligibility: " + eligibility);
    }

    Application application =
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email(email)
            .status(ApplicationReviewStatus.PENDING)
            .firstName(blankToNull(row.get(FIRST_NAME)))
            .lastName(blankToNull(row.get(LAST_NAME)))
            .permNumber(ApplicationsController.normalizePermNumber(row.get(PERM)))
            .graduationDate(blankToNull(row.get(GRADUATION)))
            .bsMsStudent(yesNo(row.get(BS_MS)))
            .studentStatusNextQuarter(studentStatus(row.get(STUDENT_STATUS)))
            .wantsTaEligibility(wantsTa)
            .otherCampusJob(otherCampusJob(row.get(OTHER_JOB)))
            .priorUcsbEmployment(yesNo(row.get(PRIOR_EMPLOYMENT)))
            .employeeId(employeeId(row.get(EMPLOYEE_ID)))
            .previousServiceAsUla(previousService(row.get(PREVIOUS_SERVICE)))
            .trainingCommitment(trainingCommitment(row.get(TRAINING)))
            .trainingCommitmentExplanation(blankToNull(row.get(TRAINING_EXPLANATION)))
            .firstChoiceCourse(first)
            .secondChoiceCourse(second)
            .availableForLecturesFirstChoice(lectures(row.get(LECTURES_FIRST)))
            .availableForLecturesSecondChoice(lectures(row.get(LECTURES_SECOND)))
            .availableForDiscussionFirstChoice(Boolean.TRUE.equals(yesNo(row.get(SECTIONS_FIRST))))
            .availableForDiscussionSecondChoice(
                Boolean.TRUE.equals(yesNo(row.get(SECTIONS_SECOND))))
            .availabilityCommentsFirstChoice(
                availability(row.get(AVAILABILITY_COMMENTS), row.get(LECTURES_FIRST)))
            .availabilityCommentsSecondChoice(availability(null, row.get(LECTURES_SECOND)))
            .gpaOverall(LegacyApplicationCsvService.gpa(row.get(GPA)))
            .major(major(row.get(MAJOR), majors))
            .changingMajor(yesNo(row.get(CHANGING_MAJOR)))
            .topicProficiencies(ratings(row, FAMILIARITY, topics, 3))
            .interests(ratings(row, ACTIVITY, interests, 5))
            .courseInterests(courseInterests)
            .videoLink(blankToNull(row.get(VIDEO)))
            .comments(notes.isEmpty() ? null : String.join("\n", notes))
            .adminComments(adminComments(row.get(TIMESTAMP)))
            .build();
    return application;
  }

  // ---- field by field -------------------------------------------------------------------------

  /** Yes or No, however capitalized; anything else (including blank) is no answer. */
  static Boolean yesNo(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String lower = text.toLowerCase(Locale.ROOT);
    if (lower.startsWith("yes")) {
      return true;
    }
    if (lower.startsWith("no")) {
      return false;
    }
    return null;
  }

  static StudentStatus studentStatus(String value) {
    String lower = value.toLowerCase(Locale.ROOT);
    if (lower.startsWith("under")) {
      return StudentStatus.UNDERGRADUATE;
    }
    if (lower.startsWith("grad")) {
      return StudentStatus.GRADUATE;
    }
    return null;
  }

  /**
   * The form's canned answers, "Yes: so I will DEFINITELY enroll..." and "No"; a free-text answer
   * about the applicant's plans is no answer here and is kept in the comments instead.
   */
  static Boolean taEligibility(String value) {
    if (value.startsWith(TA_ELIGIBILITY_YES)) {
      return true;
    }
    if (value.equals("No")) {
      return false;
    }
    return null;
  }

  static OtherCampusJob otherCampusJob(String value) {
    String lower = value.toLowerCase(Locale.ROOT);
    if (lower.startsWith("yes")) {
      return OtherCampusJob.YES;
    }
    if (lower.startsWith("no") && !lower.startsWith("not")) {
      return OtherCampusJob.NO;
    }
    if (lower.startsWith("not sure")) {
      return OtherCampusJob.NOT_SURE;
    }
    return null;
  }

  /** The UCPath id is a number; a remark typed into the box is not an id. */
  static String employeeId(String value) {
    String text = blankToNull(value);
    return text != null && text.matches("\\d+") ? text : null;
  }

  /** "0" to "6", or "More than 6", which reads as 7. */
  static Integer previousService(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    if (text.toLowerCase(Locale.ROOT).startsWith("more than")) {
      return 7;
    }
    try {
      return Integer.parseInt(text);
    } catch (NumberFormatException e) {
      return null;
    }
  }

  static TrainingCommitment trainingCommitment(String value) {
    String upper = value.toUpperCase(Locale.ROOT);
    if (upper.contains("AGREE")) {
      return TrainingCommitment.AGREE;
    }
    if (upper.contains("UNSURE")) {
      return TrainingCommitment.UNSURE;
    }
    if (upper.contains("CANNOT")) {
      return TrainingCommitment.CANNOT;
    }
    return null;
  }

  /** "1-Enthusiastic", "2-Would Consider"; "3-Not Applicable" and anything else is no interest. */
  static CourseInterest courseInterest(String value) {
    if (value.startsWith("1")) {
      return CourseInterest.ENTHUSIASTIC;
    }
    if (value.startsWith("2")) {
      return CourseInterest.WOULD_CONSIDER;
    }
    return null;
  }

  /** "Both lectures per week" and "Only one per week" are yes; "None of the lectures" is no. */
  static boolean lectures(String value) {
    String lower = value.toLowerCase(Locale.ROOT);
    return lower.startsWith("both") || lower.startsWith("only one");
  }

  /**
   * The availability comment, plus a note when only one lecture a week can be attended, since the
   * new form's yes/no cannot say so.
   */
  static String availability(String comment, String lecturesAnswer) {
    List<String> lines = new ArrayList<>();
    if (blankToNull(comment) != null) {
      lines.add(comment.strip());
    }
    if (lecturesAnswer.toLowerCase(Locale.ROOT).startsWith("only one")) {
      lines.add("Lectures: can attend only one per week.");
    }
    return lines.isEmpty() ? null : String.join("\n", lines);
  }

  /** The number that starts a course label, "24 (Mirza D)" giving "24"; null when there is none. */
  static String leadingNumber(String label) {
    Matcher m = LEADING_NUMBER.matcher(label);
    return m.find() ? m.group(1).toUpperCase(Locale.ROOT) : null;
  }

  /** The recruitment's padded course id with this number, or null. */
  static String courseByNumber(String number, Set<String> courseIds) {
    for (String courseId : courseIds) {
      if (numberOf(courseId).equalsIgnoreCase(number)) {
        return courseId;
      }
    }
    return null;
  }

  /** A first or second choice as the recruitment's course id; one it does not list is noted. */
  static String choice(String value, Set<String> courseIds, List<String> notes, String which) {
    String number = leadingNumber(value);
    if (number == null) {
      return null;
    }
    String courseId = courseByNumber(number, courseIds);
    if (courseId == null) {
      notes.add(
          "%s on the form: %s (not offered in this recruitment)"
              .formatted(which, LegacyApplicationCsvService.courseNumber(number)));
    }
    return courseId;
  }

  /**
   * The form's major, as the ULA majors list spells it when one matches ("CMPSC (Computer Science)"
   * matches "Computer Science"), else the form's text so it shows under Other.
   */
  static String major(String value, Collection<String> majors) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String lower = text.toLowerCase(Locale.ROOT);
    for (String major : majors) {
      String m = major.toLowerCase(Locale.ROOT);
      if (m.equals(lower) || lower.contains(m) || m.contains(lower)) {
        return major;
      }
    }
    return text;
  }

  /**
   * The ratings of one grid: each column's bracketed label to the leading digit of its answer
   * ("2-Somewhat comfortable" is 2), named as the admin list spells it when a name matches,
   * otherwise as the form wrote it; blank and out-of-range answers are skipped. A list name matches
   * a label spelled the same apart from spaces and punctuation, or a label that begins with it: the
   * form's "CSIL computing environment" and "Unix/Linux command line in general" are the list's
   * "CSIL" and "Unix/Linux command line".
   */
  static Map<String, Integer> ratings(Row row, String grid, Collection<String> names, int max) {
    Map<String, String> byKey = new HashMap<>();
    for (String name : names) {
      byKey.putIfAbsent(key(name), name);
    }
    Map<String, Integer> result = new TreeMap<>();
    for (int i : row.columns.all(grid)) {
      String label = row.columns.labels.get(i);
      String answer = row.at(i);
      if (label == null
          || label.isEmpty()
          || answer.isEmpty()
          || !Character.isDigit(answer.charAt(0))) {
        continue;
      }
      int level = answer.charAt(0) - '0';
      if (level < 1 || level > max) {
        continue;
      }
      result.put(listedName(label, byKey), level);
    }
    return result;
  }

  /** The list's spelling of a grid label, or the label itself when the list has nothing like it. */
  static String listedName(String label, Map<String, String> byKey) {
    String labelKey = key(label);
    if (byKey.containsKey(labelKey)) {
      return byKey.get(labelKey);
    }
    // The longest listed name the label begins with: "Unix/Linux command line in general" is the
    // list's "Unix/Linux command line" rather than its "Unix".
    return byKey.entrySet().stream()
        .filter(e -> !e.getKey().isEmpty() && labelKey.startsWith(e.getKey()))
        .max(java.util.Comparator.comparingInt(e -> e.getKey().length()))
        .map(Map.Entry::getValue)
        .orElse(label);
  }

  /** Where the row came from, for admins only. */
  static String adminComments(String timestamp) {
    String when = blankToNull(timestamp);
    return "Imported from the ULA application form"
        + (when == null ? "" : "; submitted " + when)
        + ".";
  }
}
