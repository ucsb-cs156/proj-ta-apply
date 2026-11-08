package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.BudgetCourse;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.BudgetCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The one place that reads and writes {@code budget_courses} (issue #363): the quarter's single row
 * per section, holding the enrollment estimate and the cached UCSB API figures that the TA and ULA
 * recruitments share.
 *
 * <p>The cached figures are refreshed by whatever already fetches the quarter's offerings from the
 * UCSB API (the Populate job, the Courses page's refresh on opening, Add by enroll code): no extra
 * call is ever made for them. The Courses page's refresh is the one that is gated by the time to
 * live: {@link #isFresh} says whether every figure the page would show was checked against the API
 * within {@link #TTL}, and the refresh skips the API when so.
 */
@Service
@Slf4j
public class BudgetCourseService {

  /** How long the cached enrollment figures are trusted before a page opening re-fetches them. */
  public static final Duration TTL = Duration.ofHours(24);

  @Autowired BudgetCourseRepository budgetCourseRepository;
  @Autowired BudgetCreationService budgetCreationService;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;

  /** The quarter's rows keyed by enroll code. */
  public Map<String, BudgetCourse> byEnrollCode(String quarter) {
    Map<String, BudgetCourse> result = new HashMap<>();
    for (BudgetCourse row : budgetCourseRepository.findByQuarter(quarter)) {
      result.put(row.getEnrollCode(), row);
    }
    return result;
  }

  /**
   * Fills the quarter-level figures of every row from the quarter's table, with one read, so the
   * rows' JSON is as it was before the figures moved. A row whose section has no budget course row
   * gets blanks.
   */
  public void attach(String quarter, Collection<RecruitmentCourse> rows) {
    Map<String, BudgetCourse> figures = byEnrollCode(quarter);
    for (RecruitmentCourse row : rows) {
      row.attachFigures(figures.get(row.getEnrollCode()));
    }
  }

  /** The same for one row. */
  public void attach(String quarter, RecruitmentCourse row) {
    row.attachFigures(
        budgetCourseRepository
            .findByQuarterAndEnrollCode(quarter, row.getEnrollCode())
            .orElse(null));
  }

  /**
   * The row for a recruitment course's section, created (with the quarter's budget, if that is
   * missing too) when there is none yet: the case when a recruitment first gets the section, or
   * gets it back after removing it. A new row has no figures and no estimate until the next fetch
   * or the admin's next entry.
   */
  public BudgetCourse ensure(String quarter, RecruitmentCourse row) {
    return budgetCourseRepository
        .findByQuarterAndEnrollCode(quarter, row.getEnrollCode())
        .orElseGet(() -> budgetCourseRepository.save(fresh(quarter, row)));
  }

  private BudgetCourse fresh(String quarter, RecruitmentCourse row) {
    // The quarter's budget is the row's parent: created, as a copy of the most recent earlier
    // quarter's (issue #384), if this is the first time anything needs it.
    budgetCreationService.findOrCreate(quarter);
    return BudgetCourse.builder()
        .quarter(quarter)
        .enrollCode(row.getEnrollCode())
        .courseId(row.getCourseId())
        .section(row.getSection())
        .build();
  }

  /**
   * Caches one section's figures from the API's answer for it (Add by enroll code), creating the
   * row if need be, and returns the row.
   */
  public BudgetCourse cache(String quarter, RecruitmentCourse row, UcsbSection section) {
    BudgetCourse figures = ensure(quarter, row);
    copy(section, figures, AppTime.now());
    return budgetCourseRepository.save(figures);
  }

  /**
   * After a fetch of the whole quarter's offerings (Populate, or the Courses page's refresh): makes
   * sure every given recruitment course has its row, re-caches the figures of every row of the
   * quarter whose section the fetch found, and stamps every row of the quarter as checked now,
   * found or not, so a section the API has dropped does not keep the quarter stale for ever.
   * Returns how many rows got figures.
   *
   * @param rows the recruitment's rows the fetch applied to, which must have a row here
   * @param sections every primary section the fetch returned, by enroll code
   */
  public int refreshCache(
      String quarter, Collection<RecruitmentCourse> rows, Map<String, UcsbSection> sections) {
    Map<String, BudgetCourse> existing = byEnrollCode(quarter);
    for (RecruitmentCourse row : rows) {
      existing.computeIfAbsent(row.getEnrollCode(), code -> fresh(quarter, row));
    }
    LocalDateTime now = AppTime.now();
    int cached = 0;
    for (BudgetCourse figures : existing.values()) {
      UcsbSection section = sections.get(figures.getEnrollCode());
      if (section != null) {
        copy(section, figures, now);
        cached++;
      } else {
        figures.setEnrollmentRefreshedAt(now);
      }
      budgetCourseRepository.save(figures);
    }
    return cached;
  }

  private static void copy(UcsbSection section, BudgetCourse figures, LocalDateTime now) {
    figures.setEnrollment(section.getEnrolledTotal());
    figures.setMaxEnroll(section.getMaxEnroll());
    figures.setEnrollmentRefreshedAt(now);
  }

  /**
   * Whether every given recruitment course's figures were checked against the UCSB API within
   * {@link #TTL}, so a page opening need not call it. A row with no budget course row yet, or one
   * never stamped, is not fresh. With no rows there is nothing to refresh, so they are fresh.
   */
  public boolean isFresh(String quarter, Collection<RecruitmentCourse> rows) {
    Map<String, BudgetCourse> figures = byEnrollCode(quarter);
    LocalDateTime limit = AppTime.now().minus(TTL);
    for (RecruitmentCourse row : rows) {
      BudgetCourse found = figures.get(row.getEnrollCode());
      if (found == null
          || found.getEnrollmentRefreshedAt() == null
          || found.getEnrollmentRefreshedAt().isBefore(limit)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sets (or with null clears) the section's one estimate for the quarter, as typed by the admin,
   * so with no source; creates the row if need be. Returns the row.
   */
  public BudgetCourse setEstimate(String quarter, RecruitmentCourse row, Integer estimate) {
    BudgetCourse figures = ensure(quarter, row);
    figures.setEnrollmentEstimate(estimate);
    figures.setEnrollmentEstimateSource(null);
    return budgetCourseRepository.save(figures);
  }

  /**
   * Copies the cached maximum (MAX) or current (ACTUAL) enrollment into the estimate of every given
   * section that has that figure, recording the source; a section with no row or no figure keeps
   * its estimate. Returns how many estimates were set.
   */
  public int fillEstimates(
      String quarter, Collection<RecruitmentCourse> rows, EnrollmentEstimateSource source) {
    Map<String, BudgetCourse> figures = byEnrollCode(quarter);
    int filled = 0;
    for (RecruitmentCourse row : rows) {
      BudgetCourse found = figures.get(row.getEnrollCode());
      if (found == null) {
        continue;
      }
      Integer value =
          source == EnrollmentEstimateSource.MAX ? found.getMaxEnroll() : found.getEnrollment();
      if (value != null) {
        found.setEnrollmentEstimate(value);
        found.setEnrollmentEstimateSource(source);
        budgetCourseRepository.save(found);
        filled++;
      }
    }
    return filled;
  }

  /**
   * After a recruitment removed the section: deletes the quarter's row for it unless some
   * recruitment of the quarter still has the section and has not removed it (decided by the
   * maintainer: a section that comes back starts with an empty estimate). Returns whether the row
   * was deleted.
   */
  public boolean dropIfUnused(String quarter, String enrollCode) {
    for (RecruitmentType type : RecruitmentType.values()) {
      Optional<Recruitment> recruitment = recruitmentRepository.findByQuarterAndType(quarter, type);
      if (recruitment.isPresent() && stillHas(recruitment.get(), enrollCode)) {
        return false;
      }
    }
    Optional<BudgetCourse> row =
        budgetCourseRepository.findByQuarterAndEnrollCode(quarter, enrollCode);
    row.ifPresent(
        figures -> {
          budgetCourseRepository.delete(figures);
          log.info(
              "Deleted the quarter figures of section {} in {}: no recruitment has it any more",
              enrollCode,
              quarter);
        });
    return row.isPresent();
  }

  private boolean stillHas(Recruitment recruitment, String enrollCode) {
    return recruitmentCourseRepository
        .findByRecruitmentIdAndEnrollCode(recruitment.getId(), enrollCode)
        .filter(row -> !row.isRemoved())
        .isPresent();
  }
}
