package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import edu.ucsb.cs.taapply.model.SystemInfo;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.GitProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest
public class SystemInfoServiceImplTests {

  @Autowired private SystemInfoServiceImpl systemInfoService;

  @Test
  public void testGetSystemInfo() {
    assertNotNull(systemInfoService.getSystemInfo());
  }

  @Test
  public void testGetSystemInfo_whenGitPropertiesIsNull_returnsUnknown() {
    SystemInfoServiceImpl service = new SystemInfoServiceImpl();
    ReflectionTestUtils.setField(service, "gitProperties", null);
    ReflectionTestUtils.setField(
        service, "sourceRepo", "https://github.com/ucsb-cs156/proj-ta-apply");

    SystemInfo systemInfo = service.getSystemInfo();

    assertEquals("unknown", systemInfo.getCommitMessage());
    assertEquals("unknown", systemInfo.getCommitId());
    assertEquals(
        "https://github.com/ucsb-cs156/proj-ta-apply/commit/unknown", systemInfo.getGithubUrl());
  }

  @Test
  public void testGetSystemInfo_whenGitPropertiesIsPresent_returnsGitInfo() {
    Properties properties = new Properties();
    properties.setProperty("commit.message.short", "Fix the bug");
    properties.setProperty("commit.id.abbrev", "abc1234");
    GitProperties gitProperties = new GitProperties(properties);

    SystemInfoServiceImpl service = new SystemInfoServiceImpl();
    ReflectionTestUtils.setField(service, "gitProperties", gitProperties);
    ReflectionTestUtils.setField(
        service, "sourceRepo", "https://github.com/ucsb-cs156/proj-ta-apply");

    SystemInfo systemInfo = service.getSystemInfo();

    assertEquals("Fix the bug", systemInfo.getCommitMessage());
    assertEquals("abc1234", systemInfo.getCommitId());
    assertEquals(
        "https://github.com/ucsb-cs156/proj-ta-apply/commit/abc1234", systemInfo.getGithubUrl());
  }
}
