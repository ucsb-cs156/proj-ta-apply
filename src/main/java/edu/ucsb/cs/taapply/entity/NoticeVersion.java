package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.RecruitmentType;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * One saved version of the "Notices, Terms and Conditions" text shown on the TA (or ULA)
 * application form.
 *
 * <p>Versions are never edited or deleted: every save by an admin is a new row with its own id and
 * timestamp, and an application records the id of the version its applicant agreed to, so what they
 * agreed to can always be shown back exactly. The text is Markdown, edited with the same EasyMDE
 * editor proj-citelines uses and rendered with react-markdown.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "notice_versions")
public class NoticeVersion {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Which application form this text belongs to: the TA one or the ULA one. */
  @Enumerated(EnumType.STRING)
  private RecruitmentType type;

  @Column(length = 100000)
  private String content;

  /** When this version was saved. */
  private LocalDateTime createdAt;
}
