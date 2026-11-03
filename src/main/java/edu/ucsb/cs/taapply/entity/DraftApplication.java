package edu.ucsb.cs.taapply.entity;

import com.fasterxml.jackson.core.type.TypeReference;
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
import org.hibernate.annotations.UpdateTimestamp;

/**
 * An application as it is being filled in (issue #270): what the applicant has entered so far,
 * saved as they type so that nothing they have written is ever lost.
 *
 * <p>It has the applicant-supplied fields of {@link Application}, with the same names and types,
 * and none of them is required: a draft may be empty, half-finished or inconsistent. It leaves out
 * what only a submitted application has (review status, admin comments, origin, cancellation, the
 * tentative assignment, the submission time), since a draft is none of those things. The one
 * required pair is the person and the recruitment, which is what identifies it; a person has at
 * most one draft per recruitment.
 *
 * <p>A draft is a different entity in a different table from {@link Application}, so everything
 * that reviews, counts, ranks, allocates or exports applications leaves drafts out without having
 * to know about them. Submitting the application deletes the draft.
 *
 * <p>The collections are stored as JSON text in one column each rather than in child tables: a
 * draft is only ever read and written whole, and never queried by what is in them.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder(toBuilder = true)
@Entity(name = "draft_applications")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_draft_applications_email_recruitment",
            columnNames = {"email", "recruitment_id"}))
public class DraftApplication {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recruitment_id", nullable = false)
  private Long recruitmentId;

  /** The applicant, taken from the current user rather than the request. */
  @Column(nullable = false)
  private String email;

  /** When the draft was last saved, so the home page can say how stale it is. */
  @UpdateTimestamp private LocalDateTime updatedAt;

  /**
   * How many times the draft has been saved, starting at 0. Hibernate counts it (optimistic
   * locking), and a save that carries an older count than the draft now has is refused, so two tabs
   * or windows cannot silently overwrite each other's changes.
   */
  @Version private Integer version;

  private Long noticeVersionId;

  // ---- common fields ----

  private String firstName;
  private String middleName;
  private String lastName;
  private String major;
  private Double gpaMajor;
  private Double gpaOverall;

  /** See {@link Application#isFirstQuarter()}. */
  private Boolean firstQuarter;

  private String yearInProgram;
  private String graduationDate;

  @Column(length = 4000)
  private String prevExperience;

  @Column(length = 4000)
  private String comments;

  private String firstChoiceCourse;
  private String secondChoiceCourse;

  private Boolean availableForLecturesFirstChoice;
  private Boolean availableForLecturesSecondChoice;
  private Boolean availableForDiscussionFirstChoice;
  private Boolean availableForDiscussionSecondChoice;

  @Column(length = 4000)
  private String availabilityCommentsFirstChoice;

  @Column(length = 4000)
  private String availabilityCommentsSecondChoice;

  /** Course id to interest; see {@link Application#getCourseInterests()}. */
  @Convert(converter = CourseInterestsConverter.class)
  @Column(length = 100000)
  @Builder.Default
  private Map<String, CourseInterest> courseInterests = new HashMap<>();

  /** Topic name to self-rated proficiency; see {@link Application#getTopicProficiencies()}. */
  @Convert(converter = LevelsConverter.class)
  @Column(length = 100000)
  @Builder.Default
  private Map<String, Integer> topicProficiencies = new HashMap<>();

  /** ULA interest area to level; see {@link Application#getInterests()}. */
  @Convert(converter = LevelsConverter.class)
  @Column(length = 100000)
  @Builder.Default
  private Map<String, Integer> interests = new HashMap<>();

  /**
   * The courses listed as relevant background, in order. Unsaved copies of {@link PriorCoursework},
   * which gives the same JSON as an application's rows, so a draft can pre-fill the form as one.
   */
  @Convert(converter = PriorCourseworkConverter.class)
  @Column(length = 100000)
  @Builder.Default
  private List<PriorCoursework> priorCoursework = new ArrayList<>();

  // ---- TA only ----

  @Enumerated(EnumType.STRING)
  private ResidencyStatus residencyStatus;

  @Enumerated(EnumType.STRING)
  private LanguageExamStatus languageExam;

  private String languageExamDatePassed;

  @Enumerated(EnumType.STRING)
  private ClassLevel classLevel;

  // ---- ULA only ----

  private String videoLink;
  private Integer previousServiceAsUla;
  private String permNumber;
  private Boolean bsMsStudent;

  @Enumerated(EnumType.STRING)
  private StudentStatus studentStatusNextQuarter;

  private Boolean wantsTaEligibility;

  @Enumerated(EnumType.STRING)
  private OtherCampusJob otherCampusJob;

  private Boolean priorUcsbEmployment;
  private String employeeId;

  @Column(name = "i9_appointment")
  private Boolean i9Appointment;

  @Enumerated(EnumType.STRING)
  private TrainingCommitment trainingCommitment;

  @Column(length = 4000)
  private String trainingCommitmentExplanation;

  private Boolean changingMajor;

  /** Course interests as JSON. */
  public static class CourseInterestsConverter
      extends JsonColumnConverter<Map<String, CourseInterest>> {
    public CourseInterestsConverter() {
      super(new TypeReference<>() {}, HashMap::new);
    }
  }

  /** Name-to-level maps (topic ratings, ULA interests) as JSON. */
  public static class LevelsConverter extends JsonColumnConverter<Map<String, Integer>> {
    public LevelsConverter() {
      super(new TypeReference<>() {}, HashMap::new);
    }
  }

  /** The prior coursework rows as JSON. */
  public static class PriorCourseworkConverter extends JsonColumnConverter<List<PriorCoursework>> {
    public PriorCourseworkConverter() {
      super(new TypeReference<>() {}, ArrayList::new);
    }
  }
}
