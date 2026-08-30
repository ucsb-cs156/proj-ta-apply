package edu.ucsb.cs.taapply.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import edu.ucsb.cs.taapply.models.UcsbCoursePage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
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
   * Collapses any run of whitespace in the API's space-padded course ids to a single space, and
   * trims, so the value used as a primary key is stable and reads cleanly. The API pads the subject
   * code out to eight characters, so course 156 arrives with three spaces before the number and
   * leaves here as "CMPSC 156".
   */
  public static String normalizeCourseId(String courseId) {
    if (courseId == null) {
      return null;
    }
    return courseId.trim().replaceAll("\\s+", " ");
  }
}
