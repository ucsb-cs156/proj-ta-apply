package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AuditTrailController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class AuditTrailControllerTests extends ControllerTestCase {

  @MockitoBean AuditTrailRepository auditTrailRepository;
  @MockitoBean UserRepository userRepository;

  private static AuditTrail row(long id, Long ta, Long ula, String field) {
    return AuditTrail.builder()
        .id(id)
        .editedAt(LocalDateTime.of(2026, 4, 1, 9, 30))
        .taApplicationId(ta)
        .ulaApplicationId(ula)
        .fieldName(field)
        .oldValue("before")
        .newValue("after")
        .build();
  }

  private static final List<AuditTrail> ROWS =
      List.of(row(2L, 7L, null, "major"), row(1L, null, 9L, "gpaMajor"));

  // ---- authorization: admins only ----

  @Test
  public void logged_out_users_are_refused() throws Exception {
    mockMvc.perform(get("/api/admin/audittrail/all")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/audittrail/application?type=TA&id=1"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void non_admins_are_refused() throws Exception {
    mockMvc.perform(get("/api/admin/audittrail/all")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/audittrail/application?type=TA&id=1"))
        .andExpect(status().is(403));
    verify(auditTrailRepository, never()).findAll(any(Pageable.class));
  }

  // ---- paged, sorted ----

  /** Newest first by default, ten to a page, in the same page shape as the Users page. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_default_page_is_the_first_ten_newest_first() throws Exception {
    PageRequest expectedRequest = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "id"));
    Page<AuditTrail> page = new PageImpl<>(ROWS, expectedRequest, 12);
    when(auditTrailRepository.findAll(eq(expectedRequest))).thenReturn(page);

    MvcResult response =
        mockMvc.perform(get("/api/admin/audittrail/all")).andExpect(status().isOk()).andReturn();

    AuditTrailController.AuditTrailPageDTO expected =
        new AuditTrailController.AuditTrailPageDTO(ROWS, 0, 10, 12, 2);
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
    verify(auditTrailRepository, times(1)).findAll(expectedRequest);
  }

  /** Any column, either direction, any page and size. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_page_sort_and_direction_are_passed_through() throws Exception {
    PageRequest expectedRequest = PageRequest.of(2, 25, Sort.by(Sort.Direction.ASC, "fieldName"));
    when(auditTrailRepository.findAll(eq(expectedRequest)))
        .thenReturn(new PageImpl<>(List.of(), expectedRequest, 0));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/audittrail/all?page=2&size=25&sort=fieldName&direction=asc"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(
            new AuditTrailController.AuditTrailPageDTO(List.of(), 2, 25, 0, 0)),
        response.getResponse().getContentAsString());
    verify(auditTrailRepository, times(1)).findAll(expectedRequest);
  }

  /** Every column of the table can be sorted on, and nothing else can. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void every_column_is_sortable_and_an_unknown_one_is_a_400() throws Exception {
    for (String column :
        List.of(
            "id",
            "editedAt",
            "ulaApplicationId",
            "taApplicationId",
            "fieldName",
            "oldValue",
            "newValue")) {
      PageRequest request = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, column));
      when(auditTrailRepository.findAll(eq(request)))
          .thenReturn(new PageImpl<>(List.of(), request, 0));
      mockMvc.perform(get("/api/admin/audittrail/all?sort=" + column)).andExpect(status().isOk());
    }

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/audittrail/all?sort=password"))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "Cannot sort by password (expected one of [editedAt, fieldName, id, newValue, oldValue,"
            + " taApplicationId, ulaApplicationId])",
        responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_unknown_direction_is_a_400() throws Exception {
    mockMvc
        .perform(get("/api/admin/audittrail/all?direction=sideways"))
        .andExpect(status().is(400));
    verify(auditTrailRepository, never()).findAll(any(Pageable.class));
  }

  // ---- one application's rows ----

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_rows_for_a_ta_application_come_from_the_ta_finder() throws Exception {
    when(auditTrailRepository.findByTaApplicationIdOrderByIdAsc(7L))
        .thenReturn(List.of(ROWS.get(0)));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/audittrail/application?type=TA&id=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(ROWS.get(0))),
        response.getResponse().getContentAsString());
    verify(auditTrailRepository, never()).findByUlaApplicationIdOrderByIdAsc(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_rows_for_a_ula_application_come_from_the_ula_finder() throws Exception {
    when(auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(9L))
        .thenReturn(List.of(ROWS.get(1)));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/audittrail/application?type=ULA&id=9"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(ROWS.get(1))),
        response.getResponse().getContentAsString());
    verify(auditTrailRepository, never()).findByTaApplicationIdOrderByIdAsc(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_unknown_type_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/audittrail/application?type=READER&id=7"))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals("type must be TA or ULA, not READER", responseToJson(response).get("message"));
  }
}
