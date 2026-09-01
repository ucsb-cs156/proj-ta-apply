package edu.ucsb.cs.taapply.enums;

/**
 * Whether applications are currently being accepted for a recruitment. Opening and closing is
 * manual for now: automating it while still allowing manual override is a protocol worth designing
 * separately (see docs/design/InitialDesign.md).
 */
public enum ApplicationStatus {
  OPEN,
  CLOSED
}
