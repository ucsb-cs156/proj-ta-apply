package edu.ucsb.cs.taapply.enums;

/**
 * The staff's choice in the New Hire form done (or not needed) dropdown of the Soft Offer Results
 * (issue #509); the blank choice is a null.
 */
public enum NewHireForm {
  /** "Done": the new hire form has been completed. */
  DONE,
  /** "Not needed": the hire needs no new hire form (a returning employee, say). */
  NOT_NEEDED
}
