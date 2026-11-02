package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.model.SystemInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.info.GitProperties;
import org.springframework.stereotype.Service;

@Slf4j
@Service("systemInfo")
@ConfigurationProperties
public class SystemInfoServiceImpl extends SystemInfoService {

  @Value("${spring.h2.console.enabled:false}")
  private boolean springH2ConsoleEnabled;

  @Value("${app.showSwaggerUILink:false}")
  private boolean showSwaggerUILink;

  @Value("${app.enableDeveloperMode:false}")
  private boolean enableDeveloperMode;

  @Value("${app.oauth.login:/oauth2/authorization/google}")
  private String oauthLogin;

  @Value("${app.sourceRepo:https://github.com/ucsb-cs156/proj-ta-apply}")
  private String sourceRepo;

  @Value("${app.subjectArea:CMPSC}")
  private String subjectArea;

  @Value("${app.startQtrYYYYQ:20211}")
  private String startQtrYYYYQ;

  // Background refresh timing (issue #281); read as text so a typo falls back to the default.
  @Value("${app.refresh.adminSec:5}")
  private String adminRefreshSec;

  @Value("${app.refresh.adminJitter:3}")
  private String adminRefreshJitter;

  @Value("${app.refresh.nonAdminSec:15}")
  private String nonAdminRefreshSec;

  @Value("${app.refresh.nonAdminJitter:5}")
  private String nonAdminRefreshJitter;

  // The end of the range is derived from the quarter UCSB says it currently is, so it keeps
  // itself current as quarters roll over; only the start needs configuring.
  @Autowired private UcsbQuarterService ucsbQuarterService;

  @Autowired(required = false)
  private GitProperties gitProperties;

  @Override
  public SystemInfo getSystemInfo() {
    String commitMessage =
        this.gitProperties != null ? this.gitProperties.get("commit.message.short") : "unknown";
    String commitId =
        this.gitProperties != null ? this.gitProperties.getShortCommitId() : "unknown";

    double adminBase = RefreshSetting.base(adminRefreshSec, 5);
    double nonAdminBase = RefreshSetting.base(nonAdminRefreshSec, 15);

    SystemInfo si =
        SystemInfo.builder()
            .springH2ConsoleEnabled(this.springH2ConsoleEnabled)
            .showSwaggerUILink(this.showSwaggerUILink)
            .enableDeveloperMode(this.enableDeveloperMode)
            .oauthLogin(this.oauthLogin)
            .sourceRepo(this.sourceRepo)
            .commitMessage(commitMessage)
            .commitId(commitId)
            .githubUrl(this.sourceRepo + "/commit/" + commitId)
            .subjectArea(this.subjectArea)
            .startQtrYYYYQ(this.startQtrYYYYQ)
            .endQtrYYYYQ(ucsbQuarterService.getEndQtrYYYYQ())
            .adminRefreshSec(adminBase)
            .adminRefreshJitter(RefreshSetting.jitter(adminRefreshJitter, 3, adminBase))
            .nonAdminRefresh(nonAdminBase)
            .nonAdminJitter(RefreshSetting.jitter(nonAdminRefreshJitter, 5, nonAdminBase))
            .build();
    log.info("getSystemInfo returns {}", si);
    return si;
  }
}
