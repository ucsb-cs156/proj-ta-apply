package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.models.UcsbCourse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.client.MockRestServiceServer;

/**
 * Exercises the UCSB API wrapper against a MockRestServiceServer, so no network call and no real
 * API key are ever needed.
 */
@RestClientTest(UCSBCurriculumService.class)
@Import(UCSBCurriculumServiceTests.TestObjectMapperConfig.class)
@TestPropertySource(
    properties = {
      "app.ucsb.api.consumer_key=fake-key",
      "app.ucsb.api.host=https://api.example.org"
    })
public class UCSBCurriculumServiceTests {

  @TestConfiguration
  static class TestObjectMapperConfig {
    @org.springframework.context.annotation.Bean
    ObjectMapper objectMapper() {
      return new ObjectMapper();
    }
  }

  @Autowired private MockRestServiceServer mockRestServiceServer;

  @Autowired private UCSBCurriculumService service;

  private static final String ONE_COURSE =
      """
      {"classes":[{"courseId":"CMPSC   156","title":"ADV APP PROGRAM"}]}
      """;

  /** A JSON page containing n courses, numbered from startNumber. */
  private static String pageOf(int n, int startNumber) {
    StringBuilder sb = new StringBuilder("{\"classes\":[");
    for (int i = 0; i < n; i++) {
      if (i > 0) {
        sb.append(",");
      }
      int num = startNumber + i;
      sb.append("{\"courseId\":\"CMPSC   ")
          .append(num)
          .append("\",\"title\":\"Course ")
          .append(num)
          .append("\"}");
    }
    sb.append("]}");
    return sb.toString();
  }

  @Test
  public void url_includes_level_subject_quarter_and_no_class_sections() {
    String url = service.urlForPage("CMPSC", "20241", "U", 1);
    assertTrue(url.startsWith("https://api.example.org/academics/curriculums/v1/classes/search"));
    assertTrue(url.contains("quarter=20241"));
    assertTrue(url.contains("subjectCode=CMPSC"));
    assertTrue(url.contains("objLevelCode=U"));
    assertTrue(url.contains("pageNumber=1"));
    assertTrue(url.contains("pageSize=100"));
    // We only want numbers and titles, so sections must not be requested.
    assertTrue(url.contains("includeClassSections=false"));
  }

  /** The API has no "A" code; asking for all levels means omitting the parameter entirely. */
  @Test
  public void url_omits_objLevelCode_for_level_A() {
    String url = service.urlForPage("CMPSC", "20241", "A", 1);
    assertTrue(url.contains("subjectCode=CMPSC"));
    assertTrue(
        !url.contains("objLevelCode"), "objLevelCode should be absent for level A, got " + url);
  }

  @Test
  public void getJSON_sends_the_api_key_version_and_content_negotiation_headers() {
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 1)))
        .andExpect(header("ucsb-api-key", "fake-key"))
        .andExpect(header("ucsb-api-version", "1.0"))
        .andExpect(header("Accept", "application/json"))
        .andExpect(header("Content-Type", "application/json"))
        .andRespond(withSuccess(ONE_COURSE, MediaType.APPLICATION_JSON));

    String json = service.getJSON("CMPSC", "20241", "U", 1);
    assertTrue(json.contains("CMPSC"));
    mockRestServiceServer.verify();
  }

  @Test
  public void getCourses_returns_courses_from_a_single_short_page() throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 1)))
        .andRespond(withSuccess(ONE_COURSE, MediaType.APPLICATION_JSON));

    List<UcsbCourse> courses = service.getCourses("CMPSC", "20241", "U");

    assertEquals(1, courses.size());
    assertEquals("CMPSC   156", courses.get(0).getCourseId());
    assertEquals("ADV APP PROGRAM", courses.get(0).getTitle());
    mockRestServiceServer.verify();
  }

  /**
   * A full first page must trigger a second request; proj-courses assumes one page and can
   * truncate.
   */
  @Test
  public void getCourses_follows_pagination_when_a_page_is_full() throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 1)))
        .andRespond(withSuccess(pageOf(100, 1), MediaType.APPLICATION_JSON));
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 2)))
        .andRespond(withSuccess(pageOf(3, 101), MediaType.APPLICATION_JSON));

    List<UcsbCourse> courses = service.getCourses("CMPSC", "20241", "U");

    assertEquals(103, courses.size());
    mockRestServiceServer.verify();
  }

  @Test
  public void getCourses_stops_on_an_empty_page() throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 1)))
        .andRespond(withSuccess(pageOf(100, 1), MediaType.APPLICATION_JSON));
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 2)))
        .andRespond(withSuccess("{\"classes\":[]}", MediaType.APPLICATION_JSON));

    List<UcsbCourse> courses = service.getCourses("CMPSC", "20241", "U");

    assertEquals(100, courses.size());
    mockRestServiceServer.verify();
  }

  @Test
  public void getCourses_handles_a_response_with_no_classes_field() throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", 1)))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    assertEquals(0, service.getCourses("CMPSC", "20241", "U").size());
    mockRestServiceServer.verify();
  }

  /**
   * The formatted width is what makes lexical order numerically correct: digits right-justified, so
   * a space sorts before any digit.
   */
  @Test
  public void normalizeCourseId_pads_to_a_fixed_width() {
    assertEquals("CMPSC     1", UCSBCurriculumService.normalizeCourseId("CMPSC   1  "));
    assertEquals("CMPSC     1A", UCSBCurriculumService.normalizeCourseId("CMPSC     1A "));
    assertEquals("CMPSC    16", UCSBCurriculumService.normalizeCourseId("CMPSC    16  "));
    assertEquals("CMPSC   130A", UCSBCurriculumService.normalizeCourseId("CMPSC   130A "));
    assertEquals("CMPSC   156", UCSBCurriculumService.normalizeCourseId("CMPSC   156  "));
  }

  /** Two suffix letters fit too, e.g. ECE 10AL. */
  @Test
  public void normalizeCourseId_handles_a_two_letter_suffix() {
    assertEquals("ECE      10AL", UCSBCurriculumService.normalizeCourseId("ECE      10AL"));
  }

  /** The alignment does not depend on the API padding its ids the way it currently does. */
  @Test
  public void normalizeCourseId_pads_an_unpadded_id() {
    assertEquals("CMPSC     1", UCSBCurriculumService.normalizeCourseId("CMPSC 1"));
    assertEquals("CMPSC   156", UCSBCurriculumService.normalizeCourseId("CMPSC 156"));
    assertEquals("ECE      10AL", UCSBCurriculumService.normalizeCourseId("ECE 10AL"));
  }

  /**
   * An 8-character subject fills the field exactly, so the number follows immediately. The numeric
   * column is still columns 9-11, so ids stay aligned across subjects.
   */
  @Test
  public void a_full_width_subject_code_is_not_truncated() {
    assertEquals("ENGRPHYS  1", UCSBCurriculumService.normalizeCourseId("ENGRPHYS 1"));
    assertEquals("ENGRPHYS130A", UCSBCurriculumService.normalizeCourseId("ENGRPHYS 130A"));
  }

  /** Anything that is not "subject number" is passed through rather than mangled. */
  @Test
  public void normalizeCourseId_passes_through_what_it_cannot_parse() {
    // A section id, not a course id.
    assertEquals("MATH      3B -1", UCSBCurriculumService.normalizeCourseId("MATH      3B -1 "));
    // No number at all.
    assertEquals("CMPSC", UCSBCurriculumService.normalizeCourseId("CMPSC  "));
    // More digits than a course number has.
    assertEquals("CMPSC 1234", UCSBCurriculumService.normalizeCourseId("CMPSC 1234 "));
    // Too many suffix letters.
    assertEquals("CMPSC 1ABC", UCSBCurriculumService.normalizeCourseId("CMPSC 1ABC "));
  }

  /** The whole point of the padding: sorting these strings gives numeric order. */
  @Test
  public void padded_course_ids_sort_numerically() {
    List<String> ids =
        new java.util.ArrayList<>(
            List.of(
                UCSBCurriculumService.normalizeCourseId("CMPSC   156  "),
                UCSBCurriculumService.normalizeCourseId("CMPSC     9  "),
                UCSBCurriculumService.normalizeCourseId("CMPSC   130A "),
                UCSBCurriculumService.normalizeCourseId("CMPSC    24  "),
                UCSBCurriculumService.normalizeCourseId("CMPSC     1A "),
                UCSBCurriculumService.normalizeCourseId("CMPSC   100  ")));
    java.util.Collections.sort(ids);

    assertEquals(
        List.of(
            "CMPSC     1A",
            "CMPSC     9",
            "CMPSC    24",
            "CMPSC   100",
            "CMPSC   130A",
            "CMPSC   156"),
        ids);
  }

  @Test
  public void normalizeCourseId_passes_null_through() {
    assertNull(UCSBCurriculumService.normalizeCourseId(null));
  }

  /**
   * A server that never returns a short page must not loop forever: MAX_PAGES caps the walk. Kept
   * as a real guard rather than deleted to satisfy coverage.
   */
  @Test
  public void getCourses_stops_at_MAX_PAGES_if_every_page_is_full() throws Exception {
    for (int pageNumber = 1; pageNumber <= UCSBCurriculumService.MAX_PAGES; pageNumber++) {
      mockRestServiceServer
          .expect(requestTo(service.urlForPage("CMPSC", "20241", "U", pageNumber)))
          .andRespond(
              withSuccess(pageOf(100, 1 + (pageNumber - 1) * 100), MediaType.APPLICATION_JSON));
    }

    List<UcsbCourse> courses = service.getCourses("CMPSC", "20241", "U");

    assertEquals(UCSBCurriculumService.MAX_PAGES * 100, courses.size());
    mockRestServiceServer.verify();
  }
}
