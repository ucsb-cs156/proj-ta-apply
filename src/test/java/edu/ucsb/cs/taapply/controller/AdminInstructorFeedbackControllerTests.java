package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService;
import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService.MissingRow;
import edu.ucsb.cs.taapply.services.InstructorFeedbackReportService.Row;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

/** Issue #427: the admin's read-only list of a quarter's instructor feedback. */
@WebMvcTest(controllers = AdminInstructorFeedbackController.class)
public class AdminInstructorFeedbackControllerTests extends ControllerTestCase {

  @MockitoBean InstructorFeedbackReportService instructorFeedbackReportService;

  private static final String URL = "/api/admin/instructorFeedback?quarter=20261";

  @Test
  public void logged_out_users_cannot_read_the_feedback() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
    verify(instructorFeedbackReportService, never()).rows(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_the_feedback() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
    verify(instructorFeedbackReportService, never()).rows(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_quarters_feedback_rows() throws Exception {
    List<Row> rows =
        List.of(
            new Row(
                7L,
                "20261",
                "CMPSC   156",
                "0100",
                "ADV APP PROGRAM",
                "pconrad@ucsb.edu",
                "CONRAD P",
                true,
                true,
                false,
                false,
                3,
                null,
                4,
                null,
                "More please",
                LocalDateTime.of(2026, 1, 15, 9, 30)));
    when(instructorFeedbackReportService.rows("20261")).thenReturn(rows);

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(rows), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_quarter_with_no_feedback_is_an_empty_list() throws Exception {
    when(instructorFeedbackReportService.rows("20261")).thenReturn(List.of());

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  // ---- GET /api/admin/instructorFeedback/missing ----

  private static final String MISSING = "/api/admin/instructorFeedback/missing?quarter=20261";

  @Test
  public void logged_out_users_cannot_read_who_has_not_responded() throws Exception {
    mockMvc.perform(get(MISSING)).andExpect(status().is(403));
    verify(instructorFeedbackReportService, never()).missing(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_who_has_not_responded() throws Exception {
    mockMvc.perform(get(MISSING)).andExpect(status().is(403));
    verify(instructorFeedbackReportService, never()).missing(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_who_has_not_responded() throws Exception {
    List<MissingRow> rows =
        List.of(
            new MissingRow(
                "CMPSC   156", "0100", "ADV APP PROGRAM", "CONRAD P", "pconrad@ucsb.edu"),
            new MissingRow("CMPSC   156", "0100", "ADV APP PROGRAM", "NOBODY N", null));
    when(instructorFeedbackReportService.missing("20261")).thenReturn(rows);

    MvcResult response = mockMvc.perform(get(MISSING)).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(rows), response.getResponse().getContentAsString());
  }
}
