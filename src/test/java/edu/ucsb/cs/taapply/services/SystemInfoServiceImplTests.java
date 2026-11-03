package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
    ReflectionTestUtils.setField(service, "ucsbQuarterService", stubQuarterService("20244"));
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
    ReflectionTestUtils.setField(service, "ucsbQuarterService", stubQuarterService("20244"));
    ReflectionTestUtils.setField(
        service, "sourceRepo", "https://github.com/ucsb-cs156/proj-ta-apply");

    SystemInfo systemInfo = service.getSystemInfo();

    assertEquals("Fix the bug", systemInfo.getCommitMessage());
    assertEquals("abc1234", systemInfo.getCommitId());
    assertEquals(
        "https://github.com/ucsb-cs156/proj-ta-apply/commit/abc1234", systemInfo.getGithubUrl());
  }

  private static UcsbQuarterService stubQuarterService(String endQtrYYYYQ) {
    UcsbQuarterService stub = mock(UcsbQuarterService.class);
    when(stub.getEndQtrYYYYQ()).thenReturn(endQtrYYYYQ);
    return stub;
  }

  /** Issue #217: the Developer Mode flag reaches the payload, and is off unless configured. */
  @Test
  public void testGetSystemInfo_enableDeveloperModeComesFromTheProperty() {
    SystemInfoServiceImpl service = new SystemInfoServiceImpl();
    ReflectionTestUtils.setField(service, "gitProperties", null);
    ReflectionTestUtils.setField(service, "ucsbQuarterService", stubQuarterService("20244"));

    assertEquals(false, service.getSystemInfo().getEnableDeveloperMode());

    ReflectionTestUtils.setField(service, "enableDeveloperMode", true);
    assertEquals(true, service.getSystemInfo().getEnableDeveloperMode());
  }

  /** The end quarter is derived, not configured, so verify it reaches the SystemInfo payload. */
  @Test
  public void testGetSystemInfo_endQtrComesFromTheQuarterService() {
    SystemInfoServiceImpl service = new SystemInfoServiceImpl();
    ReflectionTestUtils.setField(service, "gitProperties", null);
    ReflectionTestUtils.setField(service, "startQtrYYYYQ", "20211");
    ReflectionTestUtils.setField(service, "ucsbQuarterService", stubQuarterService("20252"));

    SystemInfo systemInfo = service.getSystemInfo();

    assertEquals("20211", systemInfo.getStartQtrYYYYQ());
    assertEquals("20252", systemInfo.getEndQtrYYYYQ());
  }

  private static SystemInfoServiceImpl serviceWithRefresh(
      String adminSec, String adminJitter, String nonAdminSec, String nonAdminJitter) {
    SystemInfoServiceImpl service = new SystemInfoServiceImpl();
    ReflectionTestUtils.setField(service, "gitProperties", null);
    ReflectionTestUtils.setField(service, "ucsbQuarterService", stubQuarterService("20244"));
    ReflectionTestUtils.setField(service, "adminRefreshSec", adminSec);
    ReflectionTestUtils.setField(service, "adminRefreshJitter", adminJitter);
    ReflectionTestUtils.setField(service, "nonAdminRefreshSec", nonAdminSec);
    ReflectionTestUtils.setField(service, "nonAdminRefreshJitter", nonAdminJitter);
    return service;
  }

  /** Issue #281: the defaults reach the payload when nothing is configured. */
  @Test
  public void testGetSystemInfo_refreshSettingsDefaultWhenUnset() {
    SystemInfo systemInfo = serviceWithRefresh(null, null, null, null).getSystemInfo();

    assertEquals(5.0, systemInfo.getAdminRefreshSec());
    assertEquals(3.0, systemInfo.getAdminRefreshJitter());
    assertEquals(15.0, systemInfo.getNonAdminRefresh());
    assertEquals(5.0, systemInfo.getNonAdminJitter());
  }

  /** Issue #281: each of the four settings reaches the payload from its own field. */
  @Test
  public void testGetSystemInfo_refreshSettingsComeFromTheirOwnProperties() {
    SystemInfo systemInfo = serviceWithRefresh("10", "2", "30", "7").getSystemInfo();

    assertEquals(10.0, systemInfo.getAdminRefreshSec());
    assertEquals(2.0, systemInfo.getAdminRefreshJitter());
    assertEquals(30.0, systemInfo.getNonAdminRefresh());
    assertEquals(7.0, systemInfo.getNonAdminJitter());
  }

  /** A bad base or jitter falls back to the default, and a jitter is kept within its base. */
  @Test
  public void testGetSystemInfo_badRefreshSettingsFallBack() {
    SystemInfo systemInfo = serviceWithRefresh("abc", "99", "2", "-1").getSystemInfo();

    assertEquals(5.0, systemInfo.getAdminRefreshSec());
    assertEquals(3.0, systemInfo.getAdminRefreshJitter());
    assertEquals(2.0, systemInfo.getNonAdminRefresh());
    assertEquals(2.0, systemInfo.getNonAdminJitter());
  }
}
