package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import lombok.*;

/**
 * One person's application to one recruitment.
 *
 * <p>The design doc's field table names email as the primary key, but the same section asks for a
 * table of every application a student has ever made. Those cannot both hold, so identity is a
 * generated id with a unique constraint on (email, recruitment): one application per person per
 * recruitment, and the history survives.
 *
 * <p>Which fields are asked for depends on the recruitment's type. The TA-only and ULA-only fields
 * are simply left null on the other kind rather than being split into separate tables, since the
 * two share most of their content and one applicant never fills in both.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "applications")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_applications_email_recruitment",
            columnNames = {"email", "recruitment_id"}))
public class Application {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recruitment_id")
  private Long recruitmentId;

  /** The applicant, taken from the current user rather than the request. */
  private String email;

  @Enumerated(EnumType.STRING)
  @Builder.Default
  private ApplicationReviewStatus status = ApplicationReviewStatus.PENDING;

  /** The one field still editable after the primary consideration date has passed. */
  @Column(length = 4000)
  private String postApplicationComments;

  /**
   * True for an application an admin entered to preview the form, "as if" they were an applicant.
   * Test applications are stored alongside real ones so the whole path is exercised, but anything
   * that reviews or counts applications should leave them out.
   */
  @Builder.Default private boolean testApplication = false;

  /**
   * The version of the "Notices, Terms and Conditions" text the applicant agreed to when they
   * submitted (or last edited) this application. Null only for applications made before any notice
   * had been written for their form type.
   */
  private Long noticeVersionId;

  // ---- common fields ----

  private String firstName;
  private String middleName;
  private String lastName;
  private String major;
  private Double gpaMajor;
  private Double gpaOverall;
  private String yearInProgram;
  private String graduationDate;

  @Column(length = 4000)
  private String courseworkUcsb;

  @Column(length = 4000)
  private String prevExperience;

  @Column(length = 4000)
  private String comments;

  /**
   * Chosen from the recruitment's course list, so the availability answers refer to real courses.
   */
  private String firstChoiceCourse;

  private String secondChoiceCourse;

  @Builder.Default private boolean availableForLecturesFirstChoice = false;
  @Builder.Default private boolean availableForLecturesSecondChoice = false;
  @Builder.Default private boolean availableForDiscussionFirstChoice = false;
  @Builder.Default private boolean availableForDiscussionSecondChoice = false;

  /**
   * How interested the applicant is in each of the recruitment's other courses, keyed by the padded
   * course id. Replaces the earlier free-text "desired courses" answer.
   *
   * <p>Sparse on purpose: a course that is absent is NOT_INTERESTED, the default, and the first and
   * second choice are never in here since they have their own fields. Rows live in a separate
   * table, so a later review page can ask "who is enthusiastic about CMPSC 156" with a query rather
   * than by parsing text. Fetched eagerly because an application is always shown whole and the map
   * is at most a few dozen entries.
   */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "application_course_interests",
      joinColumns = @JoinColumn(name = "application_id"))
  @MapKeyColumn(name = "course_id")
  @Column(name = "interest")
  @Enumerated(EnumType.STRING)
  @Builder.Default
  private Map<String, CourseInterest> courseInterests = new HashMap<>();

  /**
   * Self-rated proficiency, 1 (lowest) to 5 (highest), in each of the topics the applicant said
   * something about, keyed by topic name from the admin-maintained TA or ULA topics list. Replaces
   * the earlier free-text "languages, tools and technologies" answer, so a review page can ask "who
   * rates themselves 4 or better in Python" with a query. Sparse like the course interests: an
   * unrated topic is simply absent.
   */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "application_topic_proficiencies",
      joinColumns = @JoinColumn(name = "application_id"))
  @MapKeyColumn(name = "topic")
  @Column(name = "proficiency")
  @Builder.Default
  private Map<String, Integer> topicProficiencies = new HashMap<>();

  // ---- TA only ----

  @Enumerated(EnumType.STRING)
  private ResidencyStatus residencyStatus;

  /** Only F1 and J1 visa holders take the exam; everyone else is EXEMPT. */
  @Enumerated(EnumType.STRING)
  private LanguageExamStatus languageExam;

  private LocalDate languageExamDatePassed;

  @Enumerated(EnumType.STRING)
  private ClassLevel classLevel;

  @Column(length = 4000)
  private String courseworkOther;

  @Column(length = 4000)
  private String coursework290;

  // ---- ULA only ----

  private String videoLink;

  private Integer previousServiceAsUla;
}
