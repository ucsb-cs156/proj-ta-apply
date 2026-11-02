package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.RankingListVersion;
import edu.ucsb.cs.taapply.repository.RankingListVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * The version of a recruitment course's ranking list (issue #279), the basis of the version check
 * on a rank edit. Each statement is its own transaction, so a failed insert cannot poison anything
 * else.
 */
@Service
public class RankingVersionService {

  @Autowired RankingListVersionRepository repository;

  /** The course's version; 0 if its rankings have never been edited. */
  public int current(Long recruitmentCourseId) {
    return repository.findById(recruitmentCourseId).map(RankingListVersion::getVersion).orElse(0);
  }

  /**
   * Moves the course from version {@code expected} to the next one, and says whether it did. False
   * means the list has changed since the caller read it, and nothing was changed.
   */
  public boolean advance(Long recruitmentCourseId, int expected) {
    if (repository.advance(recruitmentCourseId, expected) == 1) {
      return true;
    }
    if (expected != 0 || repository.existsById(recruitmentCourseId)) {
      return false;
    }
    try {
      repository.create(recruitmentCourseId);
      return true;
    } catch (DataIntegrityViolationException e) {
      // Someone else created the first version a moment ago, so the caller's 0 is out of date.
      return false;
    }
  }

  /**
   * Moves the course to the next version whatever it is: for changes nobody was editing against.
   */
  public void bump(Long recruitmentCourseId) {
    if (repository.increment(recruitmentCourseId) == 0) {
      try {
        repository.create(recruitmentCourseId);
      } catch (DataIntegrityViolationException e) {
        repository.increment(recruitmentCourseId);
      }
    }
  }
}
