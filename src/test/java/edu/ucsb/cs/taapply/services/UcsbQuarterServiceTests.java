package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.client.MockRestServiceServer;

@RestClientTest(UcsbQuarterService.class)
@Import(UcsbQuarterServiceTests.TestObjectMapperConfig.class)
@TestPropertySource(
    properties = {
      "app.ucsb.api.consumer_key=fake-key",
      "app.ucsb.api.host=https://api.example.org",
      "app.endQtrYYYYQ=20999"
    })
public class UcsbQuarterServiceTests {

  @TestConfiguration
  static class TestObjectMapperConfig {
    @Bean
    ObjectMapper objectMapper() {
      // The calendar carries LocalDateTimes, so the JavaTimeModule is needed, as in production.
      return new ObjectMapper().findAndRegisterModules();
    }
  }

  @Autowired private MockRestServiceServer mockRestServiceServer;
  @Autowired private UcsbQuarterService service;
  @MockitoBean private UCSBAPIQuarterRepository repository;

  // ---- issue #151: the quarter calendar ----

  private static final String QUARTERS_JSON =
      """
      [
        {"quarter":"20212","qyy":"S21","name":"SPRING 2021","category":"SPRING",
         "academicYear":"2020-2021","firstDayOfClasses":"2021-03-29T00:00:00",
         "firstDayOfQuarter":"2021-03-29T00:00:00","pass1Begin":"2020-12-28T09:00:00",
         "lastDayThirdWeek":null,"unknownField":"ignored"},
        {"quarter":"20214","qyy":"F21","name":"FALL 2021","category":"FALL",
         "academicYear":"2021-2022","firstDayOfQuarter":"2021-09-26T00:00:00"},
        {"quarter":"20213","qyy":"M21","name":"SUMMER 2021","category":"SUMMER"},
        {"quarter":"20221","qyy":"W22","name":"WINTER 2022","category":"WINTER"},
        {"quarter":"bogus","qyy":"??","name":"NOT A QUARTER"},
        {"qyy":"NO","name":"NO QUARTER AT ALL"}
      ]
      """;

  private void expectAllQuarters() {
    mockRestServiceServer
        .expect(requestTo(service.urlForAllQuarters()))
        .andExpect(header("ucsb-api-key", "fake-key"))
        .andExpect(header("ucsb-api-version", "1.0"))
        .andRespond(withSuccess(QUARTERS_JSON, MediaType.APPLICATION_JSON));
  }

  private void savesWhatItIsGiven() {
    when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
  }

  @Test
  public void urlForAllQuarters_is_the_quarters_endpoint() {
    assertEquals(
        "https://api.example.org/academics/quartercalendar/v1/quarters",
        service.urlForAllQuarters());
  }

  @Test
  public void getAllQuartersFromAPI_parses_the_calendar_and_ignores_unknown_fields()
      throws Exception {
    expectAllQuarters();

    List<UCSBAPIQuarter> quarters = service.getAllQuartersFromAPI();

    mockRestServiceServer.verify();
    assertEquals(6, quarters.size());
    UCSBAPIQuarter spring = quarters.get(0);
    assertEquals("20212", spring.getQuarter());
    assertEquals("S21", spring.getQyy());
    assertEquals("SPRING 2021", spring.getName());
    assertEquals("SPRING", spring.getCategory());
    assertEquals("2020-2021", spring.getAcademicYear());
    assertEquals(LocalDateTime.of(2021, 3, 29, 0, 0), spring.getFirstDayOfClasses());
    assertEquals(LocalDateTime.of(2021, 3, 29, 0, 0), spring.getFirstDayOfQuarter());
    assertEquals(LocalDateTime.of(2020, 12, 28, 9, 0), spring.getPass1Begin());
    assertNull(spring.getLastDayThirdWeek());
    assertNull(spring.getLastDayOfFinals());
  }

  @Test
  public void getAllQuartersFromAPI_turns_an_empty_body_into_an_empty_list() throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForAllQuarters()))
        .andRespond(withSuccess("null", MediaType.APPLICATION_JSON));
    assertEquals(List.of(), service.getAllQuartersFromAPI());
  }

  @Test
  public void loadQuarters_saves_only_the_range_oldest_first_and_skips_bad_rows() throws Exception {
    expectAllQuarters();
    savesWhatItIsGiven();

    List<UCSBAPIQuarter> saved = service.loadQuarters("20213", "20221");

    mockRestServiceServer.verify();
    assertEquals(
        List.of("20213", "20214", "20221"),
        saved.stream().map(UCSBAPIQuarter::getQuarter).toList());
    verify(repository, times(3)).save(any());
    verify(repository, never()).delete(any());
    verify(repository, never()).deleteAll();
  }

  @Test
  public void loadQuarters_with_a_range_that_matches_nothing_saves_nothing() throws Exception {
    expectAllQuarters();
    assertEquals(List.of(), service.loadQuarters("20301", "20304"));
    verify(repository, never()).save(any());
  }

  @Test
  public void loadQuarters_rejects_a_malformed_range() {
    assertThrows(IllegalArgumentException.class, () -> service.loadQuarters("bogus", "20214"));
    assertThrows(IllegalArgumentException.class, () -> service.loadQuarters("20214", "20215"));
  }

  @Test
  public void refreshThroughEnd_starts_from_the_current_quarter_when_nothing_is_on_file()
      throws Exception {
    expectCurrentQuarter("20212");
    expectAllQuarters();
    when(repository.findTopByOrderByQuarterDesc()).thenReturn(Optional.empty());
    savesWhatItIsGiven();

    UcsbQuarterService.QuarterRefresh refresh = service.refreshThroughEnd();

    mockRestServiceServer.verify();
    // Spring looks two ahead: 20212 through 20214.
    assertEquals("20212", refresh.start());
    assertEquals("20214", refresh.end());
    assertEquals(
        List.of("20212", "20213", "20214"),
        refresh.quarters().stream().map(UCSBAPIQuarter::getQuarter).toList());
  }

  @Test
  public void refreshThroughEnd_starts_from_the_latest_quarter_on_file() throws Exception {
    expectCurrentQuarter("20212");
    expectAllQuarters();
    when(repository.findTopByOrderByQuarterDesc())
        .thenReturn(Optional.of(UCSBAPIQuarter.builder().quarter("20213").build()));
    savesWhatItIsGiven();

    UcsbQuarterService.QuarterRefresh refresh = service.refreshThroughEnd();

    assertEquals("20213", refresh.start());
    assertEquals("20214", refresh.end());
    assertEquals(
        List.of("20213", "20214"),
        refresh.quarters().stream().map(UCSBAPIQuarter::getQuarter).toList());
  }

  @Test
  public void refreshThroughEnd_with_the_file_already_past_the_end_refreshes_just_the_end()
      throws Exception {
    expectCurrentQuarter("20212");
    expectAllQuarters();
    when(repository.findTopByOrderByQuarterDesc())
        .thenReturn(Optional.of(UCSBAPIQuarter.builder().quarter("20221").build()));
    savesWhatItIsGiven();

    UcsbQuarterService.QuarterRefresh refresh = service.refreshThroughEnd();

    assertEquals("20214", refresh.start());
    assertEquals("20214", refresh.end());
    assertEquals(
        List.of("20214"), refresh.quarters().stream().map(UCSBAPIQuarter::getQuarter).toList());
  }

  @BeforeEach
  void resetCache() {
    service.clearCurrentQuarterCache();
    mockRestServiceServer.reset();
  }

  private static String currentQuarterJson(String yyyyq) {
    return "{\"quarter\":\"" + yyyyq + "\",\"name\":\"IGNORED\",\"category\":\"IGNORED\"}";
  }

  private void expectCurrentQuarter(String yyyyq) {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andRespond(withSuccess(currentQuarterJson(yyyyq), MediaType.APPLICATION_JSON));
  }

  // ---- the rule: one quarter ahead, two in Spring ----

  @Test
  public void winter_looks_one_quarter_ahead_to_spring() {
    assertEquals("20242", UcsbQuarterService.endQuarterFor("20241"));
  }

  /** Spring is the exception: look two ahead so both Summer and Fall are offered. */
  @Test
  public void spring_looks_two_quarters_ahead_to_fall() {
    assertEquals("20244", UcsbQuarterService.endQuarterFor("20242"));
  }

  @Test
  public void summer_looks_one_quarter_ahead_to_fall() {
    assertEquals("20244", UcsbQuarterService.endQuarterFor("20243"));
  }

  @Test
  public void fall_looks_one_quarter_ahead_and_rolls_into_the_next_year() {
    assertEquals("20251", UcsbQuarterService.endQuarterFor("20244"));
  }

  @Test
  public void endQuarterFor_rejects_a_malformed_quarter() {
    assertThrows(IllegalArgumentException.class, () -> UcsbQuarterService.endQuarterFor("bogus"));
    assertThrows(IllegalArgumentException.class, () -> UcsbQuarterService.endQuarterFor("20245"));
  }

  // ---- talking to the API ----

  @Test
  public void url_is_the_current_quarter_endpoint() {
    assertEquals(
        "https://api.example.org/academics/quartercalendar/v1/quarters/current",
        service.urlForCurrentQuarter());
  }

  @Test
  public void getCurrentQuarterYYYYQ_sends_the_api_headers_and_parses_the_quarter()
      throws Exception {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andExpect(header("ucsb-api-key", "fake-key"))
        .andExpect(header("ucsb-api-version", "1.0"))
        .andExpect(header("Accept", "application/json"))
        .andExpect(header("Content-Type", "application/json"))
        .andRespond(withSuccess(currentQuarterJson("20243"), MediaType.APPLICATION_JSON));

    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    mockRestServiceServer.verify();
  }

  @Test
  public void getEndQtrYYYYQ_derives_from_the_current_quarter() {
    expectCurrentQuarter("20242");
    assertEquals("20244", service.getEndQtrYYYYQ());
    mockRestServiceServer.verify();
  }

  // ---- caching ----

  @Test
  public void the_current_quarter_is_cached_between_calls() throws Exception {
    // Exactly one request is expected; a second call must be served from the cache.
    expectCurrentQuarter("20243");

    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    mockRestServiceServer.verify();
  }

  // MockRestServiceServer rejects expectations added after the first request, so both responses
  // are queued up front; they are then served in order.

  @Test
  public void an_expired_cache_is_refreshed() throws Exception {
    expectCurrentQuarter("20243");
    expectCurrentQuarter("20244");

    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    service.expireCurrentQuarterCache();
    assertEquals("20244", service.getCurrentQuarterYYYYQ());

    mockRestServiceServer.verify();
  }

  @Test
  public void a_cleared_cache_is_refetched() throws Exception {
    expectCurrentQuarter("20243");
    expectCurrentQuarter("20251");

    assertEquals("20243", service.getCurrentQuarterYYYYQ());
    service.clearCurrentQuarterCache();
    assertEquals("20251", service.getCurrentQuarterYYYYQ());

    mockRestServiceServer.verify();
  }

  // ---- degrading when the API misbehaves ----

  @Test
  public void a_response_with_no_quarter_field_is_an_error() {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    IllegalStateException e =
        assertThrows(IllegalStateException.class, () -> service.getCurrentQuarterYYYYQ());
    assertTrue(e.getMessage().contains("no current quarter"));
  }

  /** A literal JSON null body parses to a null object, which the guard must catch. */
  @Test
  public void a_null_json_body_is_an_error() {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andRespond(withSuccess("null", MediaType.APPLICATION_JSON));

    IllegalStateException e =
        assertThrows(IllegalStateException.class, () -> service.getCurrentQuarterYYYYQ());
    assertTrue(e.getMessage().contains("no current quarter"));
  }

  @Test
  public void getEndQtrYYYYQ_falls_back_when_the_api_fails() {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andRespond(withServerError());

    // app.endQtrYYYYQ from @TestPropertySource above.
    assertEquals("20999", service.getEndQtrYYYYQ());
  }

  @Test
  public void getEndQtrYYYYQ_falls_back_when_the_api_returns_an_unusable_quarter() {
    mockRestServiceServer
        .expect(requestTo(service.urlForCurrentQuarter()))
        .andRespond(withSuccess(currentQuarterJson("nope"), MediaType.APPLICATION_JSON));

    assertEquals("20999", service.getEndQtrYYYYQ());
  }
}
