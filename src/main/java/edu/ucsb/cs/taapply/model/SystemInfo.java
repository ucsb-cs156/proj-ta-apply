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
  private String oauthLogin;
  private String sourceRepo;
  private String commitMessage;
  private String commitId;
  private String githubUrl; // URL to the commit in the source repository
}
