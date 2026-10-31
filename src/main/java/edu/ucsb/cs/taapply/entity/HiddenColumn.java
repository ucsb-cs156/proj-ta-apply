package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * One column an admin has hidden on one of a recruitment's tables (issue #185): the Recruitment
 * Courses table today, others later. A row's presence is what hides the column; deleting it brings
 * the column back. Kept in its own table rather than as flags on the recruitment, and dropped with
 * the recruitment. A display preference, so not audited.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "hidden_columns")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_hidden_columns_table_recruitment_column",
            columnNames = {"table_key", "recruitment_id", "column_id"}))
public class HiddenColumn {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Which table on the recruitment's pages, e.g. "recruitmentCourses". */
  @Column(name = "table_key", nullable = false, length = 64)
  private String tableKey;

  @Column(name = "recruitment_id", nullable = false)
  private Long recruitmentId;

  /** The column's id in the frontend table, e.g. "summerSession". */
  @Column(name = "column_id", nullable = false, length = 64)
  private String columnId;
}
