package edu.ucsb.cs.taapply.services.fake;

/**
 * How many courses get fake faculty rankings (issue #220).
 *
 * <ul>
 *   <li>{@code ALL}: every course that is on offer and has no rankings yet.
 *   <li>{@code SOME}: a random, non-empty part of those courses, never all of them when there is
 *       more than one, so the review pages show both ranked and unranked courses.
 * </ul>
 */
public enum FakeRankingScope {
  ALL,
  SOME
}
