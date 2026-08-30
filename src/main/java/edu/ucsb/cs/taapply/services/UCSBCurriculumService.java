package edu.ucsb.cs.taapply.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import edu.ucsb.cs.taapply.models.UcsbCoursePage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Wraps the UCSB Academic Curriculum API, narrowed to what iteration 2 needs: the distinct course
 * numbers and titles offered in a given subject area, quarter and level.
 *
 * <p>Unlike proj-courses' service of the same name, this one requests {@code
 * includeClassSections=false}, since we want catalog entries rather than offerings, and it follows
 * pagination rather than assuming a single page of 100 results.
 */
@Service
@Slf4j
public class UCSBCurriculumService {

  @Autowired private ObjectMapper objectMapper;

  @Value("${app.ucsb.api.consumer_key}")
  private String apiKey;

  @Value("${app.ucsb.api.host}")
  private String apiHost;

  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
  private static final Duration READ_TIMEOUT = Duration.ofSeconds(60);

  /** Level meaning "all levels"; the API has no such code, so the parameter is omitted instead. */
  public static final String LEVEL_ALL = "A";

  static final int PAGE_SIZE = 100;

  /** Guards against an unexpected server response paginating forever. */
  static final int MAX_PAGES = 50;

  /** Digits, then up to two suffix letters: 1, 1A, 16, 130A, 10AL. */
  private static final Pattern COURSE_NUMBER = Pattern.compile("(\\d{1,3})([A-Za-z]{0,2})");

  public static final String CURRICULUM_ENDPOINT =
      "{apiHost}/academics/curriculums/v1/classes/search";

  private final RestTemplate restTemplate;

  public UCSBCurriculumService(RestTemplateBuilder restTemplateBuilder) {
    this.restTemplate =
        restTemplateBuilder.connectTimeout(CONNECT_TIMEOUT).readTimeout(READ_TIMEOUT).build();
  }

  /** Builds the request URL for one page. Package-private so tests can assert on it. */
  String urlForPage(String subjectArea, String quarter, String level, int pageNumber) {
    StringBuilder params = new StringBuilder();
    params.append(String.format("?quarter=%s&subjectCode=%s", quarter, subjectArea));
    // The API has no "A" level code: asking for all levels means omitting objLevelCode entirely.
    if (!LEVEL_ALL.equals(level)) {
      params.append(String.format("&objLevelCode=%s", level));
    }
    params.append(
        String.format(
            "&pageNumber=%d&pageSize=%d&includeClassSections=false", pageNumber, PAGE_SIZE));
    return CURRICULUM_ENDPOINT.replace("{apiHost}", apiHost) + params;
  }

  private HttpEntity<String> requestEntity() {
    HttpHeaders headers = new HttpHeaders();
    headers.setAccept(Arrays.asList(MediaType.APPLICATION_JSON));
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("ucsb-api-version", "1.0");
    headers.set("ucsb-api-key", this.apiKey);
    return new HttpEntity<>("body", headers);
  }

  /** Fetches one page of raw JSON. */
  public String getJSON(String subjectArea, String quarter, String level, int pageNumber) {
    String url = urlForPage(subjectArea, quarter, level, pageNumber);
    log.info("url={}", url);
    ResponseEntity<String> re =
        restTemplate.exchange(url, HttpMethod.GET, requestEntity(), String.class);
    return re.getBody();
  }

  /**
   * Every course offered in the given subject area, quarter and level, following pagination until a
   * short page is returned.
   *
   * @param level "U", "G", or "A" for all levels
   */
  public List<UcsbCourse> getCourses(String subjectArea, String quarter, String level)
      throws Exception {
    List<UcsbCourse> result = new ArrayList<>();

    for (int pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
      String json = getJSON(subjectArea, quarter, level, pageNumber);
      UcsbCoursePage page = objectMapper.readValue(json, UcsbCoursePage.class);
      List<UcsbCourse> classes = page.getClasses();

      if (classes == null || classes.isEmpty()) {
        break;
      }
      result.addAll(classes);

      // A page shorter than the page size is the last one.
      if (classes.size() < PAGE_SIZE) {
        break;
      }
    }

    return result;
  }

  /**
   * Formats a course id into a fixed-width, sortable form: the subject code left-justified in 8
   * characters, the course number's digits right-justified in 3, then up to 2 suffix letters, with
   * trailing spaces removed. So {@code "CMPSC 1"} and {@code "CMPSC 130A "} both become:
   *
   * <pre>
   * CMPSC     1
   * CMPSC     1A
   * CMPSC    16
   * CMPSC   130A
   * </pre>
   *
   * <p>Right-justifying the digits is what makes ordinary lexical ordering numerically correct, a
   * space sorting before any digit. It is also why the padding is rendered rather than collapsed:
   * the alignment on screen is exactly the sort order.
   *
   * <p>The UCSB API already returns this shape, but formatting it ourselves means the ordering does
   * not depend on that, and ids stored from any other source line up too. Anything that does not
   * parse as "subject number" is passed through with only trailing space removed, rather than being
   * mangled.
   */
  public static String normalizeCourseId(String courseId) {
    if (courseId == null) {
      return null;
    }

    String[] parts = courseId.trim().split("\\s+");
    if (parts.length != 2) {
      return courseId.stripTrailing();
    }

    Matcher matcher = COURSE_NUMBER.matcher(parts[1]);
    if (!matcher.matches()) {
      return courseId.stripTrailing();
    }

    return String.format("%-8s%3s%-2s", parts[0], matcher.group(1), matcher.group(2))
        .stripTrailing();
  }
}
