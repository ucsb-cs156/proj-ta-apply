package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
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
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
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
import org.springframework.web.util.HtmlUtils;

/**
 * Imports the legacy PHP TA application's CSV export into a TA recruitment, one application per
 * row, "as if" each student had entered it, so their next application can be pre-filled from it.
 *
 * <p>The legacy columns are matched to the new form's fields as well as they can be (see {@link
 * #map}); the answers the new form has no field for (preferred job and hours, desired courses the
 * recruitment does not list) go into the applicant's comments, and the export's bookkeeping (when
 * it was submitted and modified, the reviewer's comments) into the admin comments. The format is
 * the one in {@code docs/sample-data/legacy-ta-app-csv-example.csv}.
 *
 * <p>Rows are independent: a row whose email already has an application in the recruitment is
 * counted and left alone, so re-uploading is safe, and a row without a usable email is skipped and
 * reported rather than failing the rest.
 */
@Service
@Slf4j
public class LegacyApplicationCsvService {

  @Autowired private ApplicationRepository applicationRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired private TaTopicRepository taTopicRepository;
  @Autowired private TaMajorRepository taMajorRepository;

  /**
   * What an upload did; {@code problems} names each skipped row and why, and {@code addedTopics}
   * the knowledge topics that were not on the TA topics list and were added to it.
   */
  public static record ImportResult(
      int inserted,
      int alreadyPresent,
      int skipped,
      List<String> problems,
      List<String> addedTopics) {}

  /** The columns a legacy export must have for a row to be imported at all. */
  public static final List<String> REQUIRED_COLUMNS = List.of("email", "first_name", "last_name");

  static final String COURSE_PREFIX = "CMPSC ";

  // ---- the quarter the admin names ------------------------------------------------------------

  private static final Map<Character, Character> QUARTER_LETTERS =
      Map.of('W', '1', 'S', '2', 'M', '3', 'F', '4');

  /**
   * A quarter as an admin writes it, QYY such as W26, or already YYYYQ such as 20261, to YYYYQ.
   *
   * @throws IllegalArgumentException for anything else
   */
  public static String toYyyyq(String quarter) {
    String q = quarter == null ? "" : quarter.strip().toUpperCase(Locale.ROOT);
    if (q.matches("\\d{4}[1-4]")) {
      return q;
    }
    if (q.matches("[WSMF]\\d{2}")) {
      return "20" + q.substring(1) + QUARTER_LETTERS.get(q.charAt(0));
    }
    throw new IllegalArgumentException(
        "Quarter should be like W26, S26, M26 or F26 (or 20261), not '%s'".formatted(quarter));
  }

  // ---- the upload -----------------------------------------------------------------------------

  /**
   * Reads the file and saves one application per row into the recruitment.
   *
   * @throws ResponseStatusException 400 if the recruitment is not a TA one, the file is empty, or a
   *     required column is missing
   */
  public ImportResult upload(MultipartFile file, Recruitment recruitment)
      throws IOException, CsvException {
    if (recruitment.getType() != RecruitmentType.TA) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Legacy TA applications can only be imported into a TA recruitment");
    }
    Set<String> courseIds = new TreeSet<>();
    recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
        .filter(c -> !c.isRemoved())
        .forEach(c -> courseIds.add(c.getCourseId()));
    List<String> topics =
        StreamSupport.stream(taTopicRepository.findAll().spliterator(), false)
            .map(t -> t.getName())
            .toList();
    List<String> majors =
        StreamSupport.stream(taMajorRepository.findAll().spliterator(), false)
            .map(m -> m.getName())
            .toList();

    int inserted = 0;
    int alreadyPresent = 0;
    List<String> problems = new ArrayList<>();
    // A knowledge topic the TA topics list does not have is added to it, so the form shows the
    // imported rating rather than keeping it under a name no one can see.
    Set<String> knownTopics = new TreeSet<>(topics);
    List<String> addedTopics = new ArrayList<>();

    try (InputStream inputStream = new BufferedInputStream(file.getInputStream());
        InputStreamReader reader = new InputStreamReader(inputStream);
        CSVReader csvReader = new CSVReader(reader)) {

      String[] headers = csvReader.readNext();
      if (headers == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty");
      }
      Map<String, Integer> columns = columnIndexes(headers);

      String[] cells;
      int rowNumber = 1;
      while ((cells = csvReader.readNext()) != null) {
        rowNumber++;
        Map<String, String> row = rowMap(columns, cells);
        if (row.values().stream().allMatch(String::isBlank)) {
          continue;
        }
        String email = email(row);
        if (email == null) {
          problems.add("row %d: no usable email address".formatted(rowNumber));
          continue;
        }
        if (applicationRepository.existsByEmailAndRecruitmentId(email, recruitment.getId())) {
          alreadyPresent++;
          continue;
        }
        Application application = map(row, email, recruitment, courseIds, topics, majors);
        for (String topic : application.getTopicProficiencies().keySet()) {
          if (knownTopics.add(topic)) {
            taTopicRepository.save(TaTopic.builder().name(topic).build());
            addedTopics.add(topic);
          }
        }
        applicationRepository.save(application);
        inserted++;
      }
    }

    log.info(
        "Legacy application CSV upload into recruitment {}: inserted={} alreadyPresent={} skipped={}"
            + " addedTopics={}",
        recruitment.getId(),
        inserted,
        alreadyPresent,
        problems.size(),
        addedTopics);
    return new ImportResult(inserted, alreadyPresent, problems.size(), problems, addedTopics);
  }

  /** Column name (lower case, trimmed) to position; 400 if a required column is missing. */
  static Map<String, Integer> columnIndexes(String[] headers) {
    Map<String, Integer> columns = new HashMap<>();
    for (int i = 0; i < headers.length; i++) {
      String name = headers[i].strip().toLowerCase(Locale.ROOT);
      if (!name.isEmpty()) {
        columns.putIfAbsent(name, i);
      }
    }
    List<String> missing = REQUIRED_COLUMNS.stream().filter(c -> !columns.containsKey(c)).toList();
    if (!missing.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "CSV file is missing the column(s) %s".formatted(missing));
    }
    return columns;
  }

  /** The row as column name to trimmed value; a short row reads as blank in its missing cells. */
  static Map<String, String> rowMap(Map<String, Integer> columns, String[] cells) {
    Map<String, String> row = new HashMap<>();
    columns.forEach(
        (name, index) -> row.put(name, index < cells.length ? cells[index].strip() : ""));
    return row;
  }

  /** The row's email in canonical form, or null when there is nothing usable. */
  static String email(Map<String, String> row) {
    String raw = row.getOrDefault("email", "");
    if (raw.isBlank() || !raw.contains("@")) {
      return null;
    }
    return CanonicalFormConverter.convertToValidEmail(raw).strip();
  }

  // ---- one row to one application ---------------------------------------------------------------

  /**
   * The application a legacy row becomes, pending and never a test application, with no agreed
   * notice (the student never saw one).
   *
   * @param courseIds the recruitment's padded course ids, for matching the desired courses
   * @param topics the TA topics list, for matching the knowledge ratings' names
   * @param majors the TA majors list, for matching the major
   */
  static Application map(
      Map<String, String> row,
      String email,
      Recruitment recruitment,
      Set<String> courseIds,
      Collection<String> topics,
      Collection<String> majors) {
    List<String> unmatchedCourses = new ArrayList<>();
    Application application =
        Application.builder()
            .recruitmentId(recruitment.getId())
            .email(email)
            .status(ApplicationReviewStatus.PENDING)
            .firstName(text(row, "first_name"))
            .middleName(text(row, "middle_name"))
            .lastName(text(row, "last_name"))
            .major(major(row.get("major"), majors))
            .gpaMajor(gpa(row.get("gpa_major")))
            .gpaOverall(gpa(row.get("gpa_overall")))
            .yearInProgram(textOrNullForZero(row.get("year_in_program")))
            .graduationDate(textOrNullForZero(row.get("graduation_date")))
            .residencyStatus(residency(row.get("residency_status")))
            .languageExam(languageExam(row.get("language_exam")))
            .languageExamDatePassed(textOrNullForZero(row.get("language_exam_date_passed")))
            .classLevel(classLevel(row.get("class_level")))
            .prevExperience(prevExperience(row.get("prev_experience")))
            .topicProficiencies(knowledge(row.get("knowledge"), topics))
            .courseInterests(
                desiredCourses(
                    row.get("desired_courses_upper"),
                    row.get("desired_courses_lower"),
                    courseIds,
                    unmatchedCourses))
            .adminComments(adminComments(row))
            .build();
    application.getPriorCoursework().addAll(priorCoursework(row));
    application.setComments(comments(row, unmatchedCourses));
    return application;
  }

  // ---- field by field -------------------------------------------------------------------------

  private static String text(Map<String, String> row, String column) {
    return blankToNull(row.get(column));
  }

  static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }

  /** The legacy form stored "0" for an unanswered year or date; that is no answer. */
  static String textOrNullForZero(String value) {
    String text = blankToNull(value);
    return "0".equals(text) ? null : text;
  }

  /** A GPA as a number; blank, unparseable or zero (the legacy "not given") is no answer. */
  static Double gpa(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    try {
      double gpa = Double.parseDouble(text);
      return gpa == 0 ? null : gpa;
    } catch (NumberFormatException e) {
      return null;
    }
  }

  /**
   * The major as the new form's list spells it when it can be matched, else the legacy text so the
   * form shows it under "Other". The legacy form's "CS" means Computer Science.
   */
  static String major(String value, Collection<String> majors) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String wanted = text.equalsIgnoreCase("CS") ? "Computer Science" : text;
    for (String major : majors) {
      if (major.equalsIgnoreCase(wanted)) {
        return major;
      }
    }
    for (String major : majors) {
      if (major.toLowerCase(Locale.ROOT).contains(wanted.toLowerCase(Locale.ROOT))) {
        return major;
      }
    }
    return wanted;
  }

  /** "U.S. Citizen", "U.S. Resident", "F1 (Student) Visa", "J1 ..." or anything else. */
  static ResidencyStatus residency(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String lower = text.toLowerCase(Locale.ROOT);
    if (lower.contains("citizen")) {
      return ResidencyStatus.US_CITIZEN;
    }
    if (lower.contains("resident")) {
      return ResidencyStatus.US_RESIDENT;
    }
    if (lower.contains("f1") || lower.contains("f-1")) {
      return ResidencyStatus.F1_STUDENT_VISA;
    }
    if (lower.contains("j1") || lower.contains("j-1")) {
      return ResidencyStatus.J1_STUDENT_VISA;
    }
    return ResidencyStatus.OTHER;
  }

  /** The legacy form's own four answers, matched by their distinctive words. */
  static LanguageExamStatus languageExam(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String lower = text.toLowerCase(Locale.ROOT);
    if (lower.contains("exempt")) {
      return LanguageExamStatus.EXEMPT_US_CITIZEN;
    }
    if (lower.contains("not")) {
      return LanguageExamStatus.NOT_PASSED;
    }
    if (lower.contains("perm") || lower.contains("resident")) {
      return LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT;
    }
    if (lower.contains("pass")) {
      return LanguageExamStatus.PASSED_F1_OR_J1_VISA;
    }
    return null;
  }

  static ClassLevel classLevel(String value) {
    String text = blankToNull(value);
    if (text == null) {
      return null;
    }
    String lower = text.toLowerCase(Locale.ROOT);
    if (lower.contains("ph")) {
      return ClassLevel.PHD;
    }
    if (lower.contains("ms") || lower.contains("master")) {
      return ClassLevel.MS;
    }
    return null;
  }

  /** The entries of a legacy list cell: comma-separated, each colon-separated into fields. */
  static List<String[]> entries(String cell, int fields) {
    List<String[]> parsed = new ArrayList<>();
    // A blank entry splits into one field, so it fails the field count like any other odd entry.
    for (String entry : cell == null ? new String[0] : cell.split(",")) {
      String[] parts = entry.split(":", -1);
      if (parts.length != fields) {
        continue;
      }
      String[] clean = new String[fields];
      for (int i = 0; i < fields; i++) {
        clean[i] = HtmlUtils.htmlUnescape(parts[i]).strip();
      }
      parsed.add(clean);
    }
    return parsed;
  }

  /** "130A" becomes "CMPSC 130A"; a value that already names a department is left alone. */
  static String courseNumber(String legacy) {
    String text = legacy.strip();
    return text.matches("\\d+[A-Z]*(/[A-Z]+)?") ? COURSE_PREFIX + text : text;
  }

  private static final Pattern COURSE_CODE_290 =
      Pattern.compile("(?:CMPSC|CS)?\\s*(29\\d[A-Z]?)\\b", Pattern.CASE_INSENSITIVE);

  /**
   * The three legacy coursework cells as rows of the new table: UCSB courses ({@code
   * course:grade}), courses taken elsewhere ({@code title:school:equivalent UCSB course}) and
   * 290-level seminars ({@code description:instructor:grade}), in that order.
   */
  static List<PriorCoursework> priorCoursework(Map<String, String> row) {
    List<PriorCoursework> courses = new ArrayList<>();
    for (String[] e : entries(row.get("coursework_ucsb"), 2)) {
      if (e[0].isEmpty()) {
        continue;
      }
      courses.add(
          PriorCoursework.builder()
              .ucsbCourse(true)
              .courseNumber(courseNumber(e[0]))
              .grade(blankToNull(e[1]))
              .build());
    }
    for (String[] e : entries(row.get("coursework_other"), 3)) {
      if (e[0].isEmpty() && e[2].isEmpty()) {
        continue;
      }
      // The legacy form asked which UCSB course it was equivalent to, not for a course number.
      String number = e[2].isEmpty() ? e[0] : "%s (equivalent)".formatted(courseNumber(e[2]));
      courses.add(
          PriorCoursework.builder()
              .ucsbCourse(false)
              .otherSchool(e[1].isEmpty() ? "(school not given)" : e[1])
              .courseNumber(number)
              .courseTitle(blankToNull(e[0]))
              .build());
    }
    for (String[] e : entries(row.get("coursework_290"), 3)) {
      if (e[0].isEmpty()) {
        continue;
      }
      Matcher code = COURSE_CODE_290.matcher(e[0]);
      boolean coded = code.find();
      String number =
          coded ? COURSE_PREFIX + code.group(1).toUpperCase(Locale.ROOT) : "CMPSC 290-level";
      String title = coded ? e[0].substring(0, code.start()) + e[0].substring(code.end()) : e[0];
      title = title.replaceAll("^[\\s\\-:;,]+", "").strip();
      if (!e[1].isEmpty()) {
        title = (title.isEmpty() ? "" : title + " ") + "(%s)".formatted(e[1]);
      }
      courses.add(
          PriorCoursework.builder()
              .ucsbCourse(true)
              .courseNumber(number)
              .courseTitle(blankToNull(title))
              .grade(blankToNull(e[2]))
              .build());
    }
    return courses;
  }

  /** "130A:TA:Fall 2024" entries as lines of text, one per course. */
  static String prevExperience(String cell) {
    List<String> lines = new ArrayList<>();
    for (String[] e : entries(cell, 3)) {
      if (e[0].isEmpty()) {
        continue;
      }
      String line = courseNumber(e[0]);
      if (!e[1].isEmpty()) {
        line += ": " + e[1];
      }
      if (!e[2].isEmpty()) {
        line += ", " + e[2];
      }
      lines.add(line);
    }
    return lines.isEmpty() ? null : String.join("\n", lines);
  }

  /**
   * Lower case with spaces and ordinary punctuation dropped, for matching names spelled differently
   * ("Unix/Linux" and "Unix / Linux"). The characters that tell languages apart are kept, so "C"
   * and "C++" and "C#" stay three topics.
   */
  static String key(String name) {
    return name.toLowerCase(Locale.ROOT).replaceAll("[\\s/\\-_.,()&:;']", "");
  }

  /** "TeachingBasicsToBeginners" to "Teaching Basics To Beginners"; "C++" stays "C++". */
  static String prettify(String legacyTopic) {
    return legacyTopic.replaceAll("(?<=[a-z])(?=[A-Z])", " ");
  }

  /**
   * The knowledge ratings ({@code C++:3,Python:5,...}) as topic proficiencies on the TA scale,
   * named as the TA topics list spells them when a topic matches, else as the legacy name reads.
   */
  static Map<String, Integer> knowledge(String cell, Collection<String> topics) {
    Map<String, String> byKey = new HashMap<>();
    for (String topic : topics) {
      byKey.putIfAbsent(key(topic), topic);
    }
    Map<String, Integer> ratings = new TreeMap<>();
    for (String[] e : entries(cell, 2)) {
      int level;
      try {
        level = Integer.parseInt(e[1]);
      } catch (NumberFormatException ex) {
        continue;
      }
      if (e[0].isEmpty() || level < 1 || level > 5) {
        continue;
      }
      ratings.put(byKey.getOrDefault(key(e[0]), prettify(e[0])), level);
    }
    return ratings;
  }

  /** The number part of a padded course id: "CMPSC 156" gives "156". */
  static String numberOf(String courseId) {
    String[] parts = courseId.strip().split("\\s+");
    return parts[parts.length - 1];
  }

  /**
   * The desired courses (two cells of comma-separated numbers) as ENTHUSIASTIC interest in each
   * course the recruitment lists; a course it does not list is added to {@code unmatched} so it can
   * be kept as text.
   */
  static Map<String, CourseInterest> desiredCourses(
      String upper, String lower, Set<String> courseIds, List<String> unmatched) {
    Map<String, String> byNumber = new HashMap<>();
    for (String courseId : courseIds) {
      byNumber.putIfAbsent(numberOf(courseId).toUpperCase(Locale.ROOT), courseId);
    }
    Map<String, CourseInterest> interests = new LinkedHashMap<>();
    for (String cell : new String[] {upper, lower}) {
      if (cell == null) {
        continue;
      }
      for (String number : cell.split(",")) {
        String wanted = number.strip().toUpperCase(Locale.ROOT);
        if (wanted.isEmpty()) {
          continue;
        }
        String courseId = byNumber.get(wanted);
        if (courseId != null) {
          interests.put(courseId, CourseInterest.ENTHUSIASTIC);
        } else if (!unmatched.contains(courseNumber(wanted))) {
          unmatched.add(courseNumber(wanted));
        }
      }
    }
    return interests;
  }

  /**
   * The applicant's comments: what they wrote, then the legacy answers the new form has no field
   * for, so nothing they said is lost and they can edit it next time.
   */
  static String comments(Map<String, String> row, List<String> unmatchedCourses) {
    List<String> lines = new ArrayList<>();
    String own = blankToNull(row.get("comments_applicant"));
    if (own != null) {
      lines.add(HtmlUtils.htmlUnescape(own));
    }
    String job = blankToNull(row.get("preferred_job"));
    if (job != null) {
      lines.add("Preferred job: " + job);
    }
    String hours = textOrNullForZero(row.get("preferred_hours"));
    if (hours != null) {
      lines.add("Preferred hours per week: " + hours);
    }
    if (!unmatchedCourses.isEmpty()) {
      lines.add("Also interested in: " + String.join(", ", unmatchedCourses));
    }
    return lines.isEmpty() ? null : String.join("\n", lines);
  }

  /** Where the row came from and the export's bookkeeping, for admins only. */
  static String adminComments(Map<String, String> row) {
    List<String> parts = new ArrayList<>();
    parts.add("Imported from the legacy TA application");
    String quarter = blankToNull(row.get("application_quarter"));
    if (quarter != null) {
      parts.add("legacy quarter " + quarter);
    }
    String submitted = blankToNull(row.get("date_submitted"));
    if (submitted != null) {
      parts.add("submitted " + submitted);
    }
    String modified = blankToNull(row.get("date_modified"));
    if (modified != null) {
      parts.add("last modified " + modified);
    }
    String mustHire = blankToNull(row.get("must_hire"));
    if (mustHire != null && !"0".equals(mustHire)) {
      parts.add("must_hire " + mustHire);
    }
    String text = String.join("; ", parts) + ".";
    String reviewer = blankToNull(row.get("comments_reviewer"));
    if (reviewer != null) {
      text += "\nReviewer comments: " + HtmlUtils.htmlUnescape(reviewer);
    }
    return text;
  }
}
