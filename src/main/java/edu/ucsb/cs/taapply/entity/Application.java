package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import jakarta.persistence.*;
import java.time.LocalDate;
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
  private String knowledge;

  @Column(length = 4000)
  private String prevExperience;

  @Column(length = 4000)
  private String desiredCourses;

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
