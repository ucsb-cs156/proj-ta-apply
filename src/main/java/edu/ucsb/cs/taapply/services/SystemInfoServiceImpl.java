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

  @Value("${app.oauth.login:/oauth2/authorization/google}")
  private String oauthLogin;

  @Value("${app.sourceRepo:https://github.com/ucsb-cs156/proj-ta-apply}")
  private String sourceRepo;

  @Autowired(required = false)
  private GitProperties gitProperties;

  @Override
  public SystemInfo getSystemInfo() {
    String commitMessage =
        this.gitProperties != null ? this.gitProperties.get("commit.message.short") : "unknown";
    String commitId =
        this.gitProperties != null ? this.gitProperties.getShortCommitId() : "unknown";

    SystemInfo si =
        SystemInfo.builder()
            .springH2ConsoleEnabled(this.springH2ConsoleEnabled)
            .showSwaggerUILink(this.showSwaggerUILink)
            .oauthLogin(this.oauthLogin)
            .sourceRepo(this.sourceRepo)
            .commitMessage(commitMessage)
            .commitId(commitId)
            .githubUrl(this.sourceRepo + "/commit/" + commitId)
            .build();
    log.info("getSystemInfo returns {}", si);
    return si;
  }
}
