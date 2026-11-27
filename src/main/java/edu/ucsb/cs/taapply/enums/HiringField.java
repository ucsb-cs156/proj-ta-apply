package edu.ucsb.cs.taapply.enums;

/**
 * The hiring-tracking fields of a {@code HiringRecord} that the Soft Offer Results page saves one
 * at a time (issue #509), as the {@code field} parameter of {@code PUT
 * /api/admin/softOffers/hiring}.
 *
 * <p>The six checkbox fields take the value {@code true} (stamp now, unless already stamped) or
 * {@code false} (clear the stamp); {@link #NEW_HIRE_FORM} takes {@code DONE}, {@code NOT_NEEDED} or
 * blank; {@link #FUNDING_SOURCE} and {@link #STAFF_COMMENTS} take text, blank for none.
 */
public enum HiringField {
  FORMAL_OFFER_SENT,
  FORMAL_OFFER_ACCEPTED,
  NEW_HIRE_FORM,
  FLSA_CONFLICT_FOUND,
  FLSA_CONFLICT_RESOLVED,
  IN_UCPATH,
  I9_COMPLETE,
  FUNDING_SOURCE,
  STAFF_COMMENTS
}
