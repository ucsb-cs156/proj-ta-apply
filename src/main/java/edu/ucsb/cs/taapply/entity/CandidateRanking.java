package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Entity(name = "candidate_ranking")
@Table(
    uniqueConstraints =
        @UniqueConstraint(columnNames = {"recruitment_course_id", "application_id"}))
public class CandidateRanking {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recruitment_course_id", nullable = false)
  private Long recruitmentCourseId;

  @Column(name = "application_id", nullable = false)
  private Long applicationId;

  private Integer rank;
}
