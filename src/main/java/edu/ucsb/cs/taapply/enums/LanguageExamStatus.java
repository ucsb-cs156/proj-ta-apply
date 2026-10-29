package edu.ucsb.cs.taapply.enums;

/**
 * The TA language exam question, with the answers the legacy form offered, in its order: exempt as
 * a U.S. citizen, passed as a U.S. permanent resident, passed on an F1 or J1 visa, or not passed.
 * Asked of every TA applicant; the ULA form does not ask it.
 */
public enum LanguageExamStatus {
  EXEMPT_US_CITIZEN,
  PASSED_US_PERMANENT_RESIDENT,
  PASSED_F1_OR_J1_VISA,
  NOT_PASSED
}
