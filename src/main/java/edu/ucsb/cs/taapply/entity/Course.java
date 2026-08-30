package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * A course in the managed subject area (see {@code app.subjectArea}) that has been offered in at
 * least one quarter the admin has populated from the UCSB API.
 *
 * <p>Only the course number and title are stored, not per-offering data. {@code needsTa} and {@code
 * needsUla} are admin-curated and are never modified by the populate job.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "courses")
public class Course {
  /** Normalized course id, e.g. "CMPSC 156" (single internal space, trimmed). */
  @Id private String courseId;

  private String title;

  @Builder.Default private boolean needsTa = false;

  @Builder.Default private boolean needsUla = false;
}
