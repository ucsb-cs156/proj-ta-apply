package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The version of one recruitment course's whole ranking list (issue #279), bumped by every rank
 * edit and by the Developer Mode fake rankings job. A course whose rankings have never been edited
 * has no row, which counts as version 0. Changed only by compare-and-set statements (see {@code
 * RankingListVersionRepository}), never by saving this entity, so that two edits cannot both win.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity(name = "ranking_list_version")
@Table(name = "ranking_list_versions")
public class RankingListVersion {
  @Id
  @Column(name = "recruitment_course_id")
  private Long recruitmentCourseId;

  @Column(nullable = false)
  private Integer version;
}
