package edu.ucsb.cs.taapply;

import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.google.gson.JsonObject;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.CDPSession;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.Tracing;
import com.microsoft.playwright.options.LoadState;
import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.wiremock.WiremockServiceImpl;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.api.extension.TestExecutionExceptionHandler;
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
  @Autowired protected CourseRepository courseRepository;
  @Autowired protected RecruitmentRepository recruitmentRepository;
  @Autowired protected RecruitmentCourseRepository recruitmentCourseRepository;

  @LocalServerPort private int port;

  @Value("${app.playwright.headless:true}")
  private boolean runHeadless;

  protected static WireMockServer wireMockServer;

  protected Browser browser;

  /** The browser's own time zone: anything but Pacific, which the app must show regardless. */
  protected static final String BROWSER_TIME_ZONE = "Asia/Tokyo";

  protected Page page;

  /**
   * Stress knobs (issue #340), all off by default: they slow the browser down so a test that only
   * passes on a fast machine fails here, where it can be looked at. Set them on the command line,
   * for example {@code -Dapp.playwright.cpuThrottle=6 -Dapp.playwright.networkLatencyMs=150
   * -Dapp.playwright.slowMoMs=50}. {@code cpuThrottle} is Chrome's CPU throttling rate (4 means
   * four times slower).
   */
  @Value("${app.playwright.cpuThrottle:1}")
  private double cpuThrottle;

  @Value("${app.playwright.networkLatencyMs:0}")
  private double networkLatencyMs;

  @Value("${app.playwright.slowMoMs:0}")
  private double slowMoMs;

  /** Where the trace, screenshot and page text of a failed test go; the job uploads this folder. */
  protected static final Path ARTIFACT_DIR = Path.of("target", "playwright-artifacts");

  /** Every context a test opened, so a failure can save what each of them was doing. */
  private final List<BrowserContext> contexts = new CopyOnWriteArrayList<>();

  /** What each page said in its console, and which requests failed, for a failure to report. */
  private final List<String> browserLog = new CopyOnWriteArrayList<>();

  /** Requests sent and not yet answered, for {@link #awaitSettled(Page)}. */
  private final Set<Request> inFlight = ConcurrentHashMap.newKeySet();

  private final AtomicLong lastNetworkActivity = new AtomicLong(System.nanoTime());

  /** Saves the evidence of a failed test while its browser is still open. */
  @RegisterExtension final FailureArtifacts failureArtifacts = new FailureArtifacts();

  /** JUnit calls this when a test method fails, before {@link #teardown()} closes the browser. */
  final class FailureArtifacts implements TestExecutionExceptionHandler {
    @Override
    public void handleTestExecutionException(ExtensionContext context, Throwable throwable)
        throws Throwable {
      saveArtifacts(
          context.getRequiredTestClass().getSimpleName()
              + "."
              + context.getRequiredTestMethod().getName());
      throw throwable;
    }
  }

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
    // The quarter calendar for the same fixed range (issue #151): the quarters an admin's
    // Quarters page or a Courses populate can save are 20211..20214.
    wireMockServer.stubFor(
        com.github.tomakehurst.wiremock.client.WireMock.get(
                com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                    "/academics/quartercalendar/v1/quarters"))
            .willReturn(
                com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                        [
                          {"quarter":"20211","qyy":"W21","name":"WINTER 2021","category":"WINTER",
                           "academicYear":"2020-2021","firstDayOfQuarter":"2021-01-04T00:00:00",
                           "firstDayOfClasses":"2021-01-04T00:00:00","lastDayOfClasses":"2021-03-12T00:00:00",
                           "pass1Begin":"2020-11-09T09:00:00"},
                          {"quarter":"20212","qyy":"S21","name":"SPRING 2021","category":"SPRING",
                           "academicYear":"2020-2021","firstDayOfQuarter":"2021-03-29T00:00:00",
                           "firstDayOfClasses":"2021-03-29T00:00:00","lastDayOfClasses":"2021-06-11T00:00:00",
                           "pass1Begin":"2020-12-28T09:00:00"},
                          {"quarter":"20213","qyy":"M21","name":"SUMMER 2021","category":"SUMMER",
                           "academicYear":"2020-2021","firstDayOfQuarter":"2021-06-28T00:00:00"},
                          {"quarter":"20214","qyy":"F21","name":"FALL 2021","category":"FALL",
                           "academicYear":"2021-2022","firstDayOfQuarter":"2021-09-26T00:00:00",
                           "firstDayOfClasses":"2021-10-01T00:00:00","lastDayOfFinals":"2021-12-17T00:00:00"},
                          {"quarter":"20221","qyy":"W22","name":"WINTER 2022","category":"WINTER"}
                        ]
                        """)));
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
    setupUser(false, false);
  }

  public void setupAdminUser() {
    setupUser(true, false);
  }

  public void setupInstructorUser() {
    setupUser(false, true);
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
  private void setupUser(boolean isAdmin, boolean isInstructor) {
    String email = isInstructor ? "instructor@ucsb.edu" : "cgaucho@ucsb.edu";
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
            .launch(new BrowserType.LaunchOptions().setHeadless(runHeadless).setSlowMo(slowMoMs));

    contexts.clear();
    page = newPage(newContext());

    String url = String.format("http://localhost:%d/oauth2/authorization/my-oauth-provider", port);
    page.navigate(url);

    page.locator("#username").fill(email);
    page.locator("#password").fill("password");
    page.locator("#submit").click();
    awaitSignedIn(page);
  }

  /**
   * Waits until the sign-in has finished and the browser is back on the app. Clicking the sign-in
   * button returns before the redirects have, and a test that navigated by the page's current
   * address right then would navigate on the mock OAuth server instead (issue #340).
   */
  protected void awaitSignedIn(Page p) {
    p.waitForURL(u -> u.startsWith("http://localhost:") && !u.startsWith("http://localhost:8090/"));
    awaitSettled(p);
  }

  /**
   * A new browser context, recording a trace (with screenshots) that is kept only if the test
   * fails. A browser that is not in California (issue #293): the app must show Pacific time anyway.
   */
  protected BrowserContext newContext() {
    return newContext(new Browser.NewContextOptions().setTimezoneId(BROWSER_TIME_ZONE));
  }

  /** A new traced browser context with the given options, such as a second window of a user. */
  protected BrowserContext newContext(Browser.NewContextOptions options) {
    BrowserContext context = browser.newContext(options);
    context
        .tracing()
        .start(
            new Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(false));
    contexts.add(context);
    return context;
  }

  /** A new page in the context, slowed as the stress knobs say, and watched for the failure log. */
  protected Page newPage(BrowserContext context) {
    Page newPage = context.newPage();
    newPage.onConsoleMessage(m -> browserLog.add("console." + m.type() + ": " + m.text()));
    newPage.onPageError(e -> browserLog.add("pageerror: " + e));
    newPage.onRequest(
        r -> {
          if (!isHeartbeat(r)) {
            inFlight.add(r);
            lastNetworkActivity.set(System.nanoTime());
          }
        });
    newPage.onRequestFinished(this::requestOver);
    newPage.onRequestFailed(
        r -> {
          browserLog.add("request failed: " + r.method() + " " + r.url() + " " + r.failure());
          requestOver(r);
        });
    if (cpuThrottle > 1 || networkLatencyMs > 0) {
      CDPSession cdp = context.newCDPSession(newPage);
      if (cpuThrottle > 1) {
        JsonObject cpu = new JsonObject();
        cpu.addProperty("rate", cpuThrottle);
        cdp.send("Emulation.setCPUThrottlingRate", cpu);
      }
      if (networkLatencyMs > 0) {
        JsonObject network = new JsonObject();
        network.addProperty("offline", false);
        network.addProperty("latency", networkLatencyMs);
        network.addProperty("downloadThroughput", -1);
        network.addProperty("uploadThroughput", -1);
        cdp.send("Network.enable");
        cdp.send("Network.emulateNetworkConditions", network);
      }
    }
    return newPage;
  }

  private void requestOver(Request request) {
    if (!isHeartbeat(request)) {
      inFlight.remove(request);
      lastNetworkActivity.set(System.nanoTime());
    }
  }

  /**
   * Requests that say nothing about whether the page has finished loading: the heartbeat the page
   * sends every couple of seconds to say it is still open, and the goodbye it sends as it is left,
   * which the browser never reports as finished because the page is gone.
   */
  private static boolean isHeartbeat(Request request) {
    return request.url().contains("/heartbeat") || request.url().contains("/leave");
  }

  /** Reloads the page and waits until it has settled; see {@link #awaitSettled(Page)}. */
  protected void reloadPage(Page p) {
    p.reload();
    awaitSettled(p);
  }

  /**
   * Opens the path of the app the page is already on and waits until the page has settled, so a
   * test never clicks a table or a form that is still being filled in (issue #340).
   */
  protected void openPage(Page p, String path) {
    p.navigate(p.url().replaceAll("(http://localhost:\\d+).*", "$1" + path));
    awaitSettled(p);
  }

  /**
   * Waits until the page has loaded, has sent every request it was going to and has drawn the
   * answers. Playwright's own "network idle" is not enough: it fires after half a second of quiet,
   * and on a slow machine the requests that follow an answer (the draft after the recruitment, the
   * catalog after the form) can come later than that, and are then missed. This waits for no
   * request in flight (the periodic heartbeat aside) for a quiet spell, and then for two frames, so
   * the last answer has been drawn. For a page that needs one particular thing, also wait for it
   * with an assertion.
   */
  protected void awaitSettled(Page p) {
    p.waitForLoadState(LoadState.LOAD);
    long quietNanos = 750_000_000L;
    long deadline = System.nanoTime() + 20_000_000_000L;
    while (System.nanoTime() < deadline) {
      boolean quiet =
          inFlight.isEmpty() && System.nanoTime() - lastNetworkActivity.get() > quietNanos;
      if (quiet) {
        break;
      }
      p.waitForTimeout(50);
    }
    if (!inFlight.isEmpty()) {
      String message =
          "page did not settle; still waiting for " + inFlight.stream().map(Request::url).toList();
      browserLog.add(message);
      System.out.println("AWAIT_SETTLED " + message);
    }
    p.evaluate(
        "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(0))))");
  }

  private void saveArtifacts(String name) {
    try {
      Files.createDirectories(ARTIFACT_DIR);
      // A retried test fails again under the same name: keep the first attempt's evidence, which
      // is the one that says what went wrong, and number the later ones.
      String attempt =
          Files.exists(ARTIFACT_DIR.resolve(name + ".browser-log.txt"))
              ? ".retry" + System.nanoTime()
              : "";
      int c = 0;
      for (BrowserContext context : contexts) {
        int n = 0;
        for (Page p : context.pages()) {
          String base = name + attempt + ".context" + c + ".page" + n++;
          Files.writeString(
              ARTIFACT_DIR.resolve(base + ".txt"),
              "url: " + p.url() + "\n\n" + p.locator("body").innerText());
          Files.writeString(ARTIFACT_DIR.resolve(base + ".html"), p.content());
          p.screenshot(
              new Page.ScreenshotOptions()
                  .setFullPage(true)
                  .setPath(ARTIFACT_DIR.resolve(base + ".png")));
        }
        context
            .tracing()
            .stop(
                new Tracing.StopOptions()
                    .setPath(ARTIFACT_DIR.resolve(name + attempt + ".context" + c + ".trace.zip")));
        c++;
      }
      Files.write(ARTIFACT_DIR.resolve(name + attempt + ".browser-log.txt"), browserLog);
      System.out.println("PLAYWRIGHT ARTIFACTS for " + name + " saved in " + ARTIFACT_DIR);
    } catch (IOException | RuntimeException e) {
      // Evidence is a bonus: never hide the failure that is being reported.
      System.out.println("Could not save the Playwright artifacts for " + name + ": " + e);
    }
  }
}
