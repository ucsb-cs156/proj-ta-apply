package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

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
   * When the row was first saved: the moment the applicant (or an admin testing the form) first
   * submitted. Stamped by Hibernate on insert and never changed by an edit.
   */
  @CreationTimestamp
  @Column(name = "submitted_at", updatable = false)
  private LocalDateTime submittedAt;

  /** An admin's free-text notes on this application (Admin > Recruitments > Applications). */
  @Column(length = 4000)
  private String adminComments;

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

  /** Free text about the applicant's availability for that course's lectures and sections. */
  @Column(length = 4000)
  private String availabilityCommentsFirstChoice;

  @Column(length = 4000)
  private String availabilityCommentsSecondChoice;

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

  /**
   * How interested a ULA applicant is, 1 (not interested) to 5 (very interested), in each of the
   * areas the applicant answered for, keyed by name from the admin-maintained ULA interests list.
   * Sparse like the topic ratings: an unanswered area is simply absent. A TA application has none.
   */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "application_interests",
      joinColumns = @JoinColumn(name = "application_id"))
  @MapKeyColumn(name = "interest")
  @Column(name = "level")
  @Builder.Default
  private Map<String, Integer> interests = new HashMap<>();

  /**
   * The courses the applicant lists as relevant background, one row each, in the order given.
   * Replaced wholesale on every edit (orphan removal deletes the old rows), so the rows always
   * mirror the table the applicant last saved. A TA application needs at least three, a ULA
   * application at least one; the controller enforces that.
   */
  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "application_id", nullable = false)
  @OrderColumn(name = "position")
  @Builder.Default
  private List<PriorCoursework> priorCoursework = new ArrayList<>();

  // ---- TA only ----

  @Enumerated(EnumType.STRING)
  private ResidencyStatus residencyStatus;

  /** The TA language exam, with the legacy form's four answers; asked of every TA applicant. */
  @Enumerated(EnumType.STRING)
  private LanguageExamStatus languageExam;

  /** "Quarter and Year Language Exam Passed", free text as on the legacy form, e.g. F25. */
  private String languageExamDatePassed;

  @Enumerated(EnumType.STRING)
  private ClassLevel classLevel;

  // ---- ULA only ----

  private String videoLink;

  private Integer previousServiceAsUla;

  /** The UCSB perm number, 7 letters or digits, stored upper case. Required of a ULA applicant. */
  private String permNumber;

  /** Accepted to, or considering applying to, a BS/MS program. */
  private Boolean bsMsStudent;

  /** For a BS/MS student: their status in the quarter applied for. */
  @Enumerated(EnumType.STRING)
  private StudentStatus studentStatusNextQuarter;

  /** For a BS/MS student: whether they want TA eligibility and so will take the Fall training. */
  private Boolean wantsTaEligibility;

  @Enumerated(EnumType.STRING)
  private OtherCampusJob otherCampusJob;

  /** Ever paid by the University of California in any position. */
  private Boolean priorUcsbEmployment;

  /** The UCPath employee id, for someone who has been employed at UCSB; never the perm or SSN. */
  private String employeeId;

  /**
   * Has made, or will make, an appointment to complete the I-9 employment verification. Named
   * explicitly: the naming strategy would not put an underscore after the digit.
   */
  @Column(name = "i9_appointment")
  private Boolean i9Appointment;

  /** A first-time applicant's answer to the mandatory training commitment statement. */
  @Enumerated(EnumType.STRING)
  private TrainingCommitment trainingCommitment;

  /** Why they are unsure or cannot commit, when they said so. */
  @Column(length = 4000)
  private String trainingCommitmentExplanation;

  /** Changing into, or adding, a CS, CE or CCS Computing major. */
  private Boolean changingMajor;
}
