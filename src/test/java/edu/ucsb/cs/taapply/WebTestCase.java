package edu.ucsb.cs.taapply;

import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.GradStudent;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.wiremock.WiremockServiceImpl;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.wiremock.extension.jwt.JwtExtensionFactory;

@ActiveProfiles("integration")
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
public abstract class WebTestCase {

  @Autowired UserRepository userRepository;
  @Autowired AdminRepository adminRepository;
  @Autowired InstructorRepository instructorRepository;
  @Autowired GradStudentRepository gradStudentRepository;
  @Autowired protected CourseRepository courseRepository;

  @LocalServerPort private int port;

  @Value("${app.playwright.headless:true}")
  private boolean runHeadless;

  protected static WireMockServer wireMockServer;

  protected Browser browser;
  protected Page page;

  @BeforeAll
  public static void setupWireMock() {
    wireMockServer =
        new WireMockServer(
            options().port(8090).globalTemplating(true).extensions(new JwtExtensionFactory()));
    WiremockServiceImpl.setupOauthMocks(wireMockServer, "cgaucho@ucsb.edu");
    // Spring 2021, so UcsbQuarterService derives an end quarter of Fall 2021 (Spring looks two
    // ahead). With app.startQtrYYYYQ=20211 that gives the dropdowns a fixed 20211..20214 range,
    // and exercises the real derivation rather than the offline fallback.
    wireMockServer.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get(
                com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                    "/academics/quartercalendar/v1/quarters/current"))
            .willReturn(
                com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"quarter\":\"20212\"}")));
    wireMockServer.start();
  }

  @AfterAll
  public static void teardownWiremock() {
    wireMockServer.stop();
  }

  @AfterEach
  public void teardown() {
    browser.close();
  }

  public void setupRegularUser() {
    setupUser(false, false, false);
  }

  public void setupAdminUser() {
    setupUser(true, false, false);
  }

  public void setupInstructorUser() {
    setupUser(false, true, false);
  }

  public void setupGradStudentUser() {
    setupUser(false, false, true);
  }

  /**
   * Logs in as the given email without inserting any Admin/Instructor row, so any roles the user
   * ends up with come entirely from what's already in the database (e.g. from ADMIN_EMAILS having
   * been seeded into the admins table at startup, rather than a test manually granting the role).
   */
  public void setupUserWithEmail(String email) {
    User user =
        User.builder()
            .email(email)
            .familyName("Gaucho")
            .givenName("Chris")
            .fullName("Chris Gaucho")
            .googleSub("123456789")
            .pictureUrl("")
            .build();
    userRepository.save(user);
    login(email);
  }

  @SuppressWarnings("null")
  private void setupUser(boolean isAdmin, boolean isInstructor, boolean isGradStudent) {
    String email = isInstructor ? "instructor@ucsb.edu" : "cgaucho@ucsb.edu";
    email = isGradStudent ? "gradstudent@ucsb.edu" : email;
    email = isAdmin ? "admin@ucsb.edu" : email;

    User user =
        User.builder()
            .email(email)
            .familyName("Gaucho")
            .givenName("Chris")
            .fullName("Chris Gaucho")
            .googleSub("123456789")
            .pictureUrl("")
            .build();

    userRepository.save(user);
    if (isInstructor) {
      instructorRepository.save(Instructor.builder().email(email).build());
    }
    if (isGradStudent) {
      gradStudentRepository.save(GradStudent.builder().email(email).build());
    }
    if (isAdmin) {
      adminRepository.save(Admin.builder().email(email).build());
    }

    login(email);
  }

  /** Log in with no User row and no role granted, to exercise the access gate. */
  public void loginAs(String email) {
    login(email);
  }

  private void login(String email) {
    WiremockServiceImpl.setupOauthMocks(wireMockServer, email);

    browser =
        Playwright.create()
            .chromium()
            .launch(new BrowserType.LaunchOptions().setHeadless(runHeadless));

    BrowserContext context = browser.newContext();
    page = context.newPage();

    String url = String.format("http://localhost:%d/oauth2/authorization/my-oauth-provider", port);
    page.navigate(url);

    page.locator("#username").fill(email);
    page.locator("#password").fill("password");
    page.locator("#submit").click();
  }
}
