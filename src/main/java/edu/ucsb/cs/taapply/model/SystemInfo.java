package edu.ucsb.cs.taapply.model;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
public class SystemInfo {
  private Boolean springH2ConsoleEnabled;
  private Boolean showSwaggerUILink;

  /**
   * Whether the Developer Mode switch exists on this instance (issue #217); never in production.
   */
  private Boolean enableDeveloperMode;

  private String oauthLogin;
  private String sourceRepo;
  private String commitMessage;
  private String commitId;
  private String githubUrl; // URL to the commit in the source repository
  private String subjectArea; // the single subject area this app manages, e.g. CMPSC
  private String startQtrYYYYQ; // inclusive bounds for the admin Courses page quarter dropdowns
  private String endQtrYYYYQ;

  // Background refresh timing in seconds (issue #281), already checked by RefreshSetting. A wait is
  // uniform between base - jitter and base + jitter.
  private Double adminRefreshSec;
  private Double adminRefreshJitter;
  private Double nonAdminRefresh;
  private Double nonAdminJitter;
}
