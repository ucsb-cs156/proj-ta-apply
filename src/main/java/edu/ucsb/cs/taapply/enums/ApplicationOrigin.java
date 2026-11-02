package edu.ucsb.cs.taapply.enums;

/**
 * Where an application came from (issue #219): a real applicant, an admin previewing the form (the
 * Test Application page), or the Developer Mode generator of fake data. It replaces the old {@code
 * testApplication} flag, which could not tell the last two apart.
 */
public enum ApplicationOrigin {
  /** Entered by a real applicant. */
  APPLICANT,
  /** Entered by an admin to preview the form. */
  ADMIN_TEST,
  /** Created by the Developer Mode "Create Fake Applications" job. */
  DEVELOPER_MODE
}
