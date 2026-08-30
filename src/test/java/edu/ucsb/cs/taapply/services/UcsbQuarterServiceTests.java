package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
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
      return new ObjectMapper();
    }
  }

  @Autowired private MockRestServiceServer mockRestServiceServer;
  @Autowired private UcsbQuarterService service;

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
