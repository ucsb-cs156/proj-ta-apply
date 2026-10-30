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
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = RecruitmentAuditTrailController.class)
@Import(TestConfig.class)
public class RecruitmentAuditTrailControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentAuditTrailRepository repository;
  @MockitoBean UserRepository userRepository;

  private static RecruitmentAuditTrail row(long id, String what, String oldValue, String newValue) {
    return RecruitmentAuditTrail.builder()
        .id(id)
        .changedAt(LocalDateTime.of(2026, 1, 6, 9, 30))
        .recruitmentId(7L)
        .whatChanged(what)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  @Test
  public void logged_out_users_cannot_read_the_trail() throws Exception {
    mockMvc
        .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7"))
        .andExpect(status().is(403));
    verify(repository, never()).findByRecruitmentId(any(), any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_read_the_trail() throws Exception {
    mockMvc
        .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_the_trail() throws Exception {
    mockMvc
        .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7"))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_first_page_newest_first_by_default() throws Exception {
    List<RecruitmentAuditTrail> rows =
        List.of(
            row(3L, "actualOpeningDate", null, "2026-01-06"),
            row(2L, "applicationStatus", "CLOSED", "OPEN"),
            row(1L, "created", null, null));
    when(repository.findByRecruitmentId(eq(7L), any()))
        .thenReturn(new PageImpl<>(rows, PageRequest.of(0, 10), 3));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
    verify(repository, times(1)).findByRecruitmentId(eq(7L), captor.capture());
    Pageable pageable = captor.getValue();
    assertEquals(0, pageable.getPageNumber());
    assertEquals(10, pageable.getPageSize());
    assertEquals(Sort.by(Sort.Direction.DESC, "id"), pageable.getSort());

    RecruitmentAuditTrailController.RecruitmentAuditTrailPageDTO expected =
        new RecruitmentAuditTrailController.RecruitmentAuditTrailPageDTO(rows, 0, 10, 3, 1);
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
    Map<String, Object> json = responseToJson(response);
    assertEquals(0, json.get("number"));
    assertEquals(10, json.get("size"));
    assertEquals(3, json.get("totalElements"));
    assertEquals(1, json.get("totalPages"));
    assertEquals(3, ((List<?>) json.get("content")).size());
    assertEquals(rows, expected.content());
    assertEquals(0, expected.number());
    assertEquals(10, expected.size());
    assertEquals(3L, expected.totalElements());
    assertEquals(1, expected.totalPages());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_page_size_sort_and_direction_are_passed_through() throws Exception {
    when(repository.findByRecruitmentId(eq(7L), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(2, 5), 0));

    mockMvc
        .perform(
            get(
                "/api/admin/recruitmentaudittrail/all?recruitmentId=7&page=2&size=5&sort=changedAt&direction=asc"))
        .andExpect(status().isOk());

    ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
    verify(repository, times(1)).findByRecruitmentId(eq(7L), captor.capture());
    Pageable pageable = captor.getValue();
    assertEquals(2, pageable.getPageNumber());
    assertEquals(5, pageable.getPageSize());
    assertEquals(Sort.by(Sort.Direction.ASC, "changedAt"), pageable.getSort());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void every_column_can_be_sorted_by() throws Exception {
    assertEquals(
        List.of("changedAt", "id", "newValue", "oldValue", "recruitmentId", "whatChanged"),
        RecruitmentAuditTrailController.SORTABLE.stream().sorted().toList());
    when(repository.findByRecruitmentId(eq(7L), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
    for (String column : RecruitmentAuditTrailController.SORTABLE) {
      mockMvc
          .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7&sort=" + column))
          .andExpect(status().isOk());
    }
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_column_that_is_not_the_table_s_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7&sort=quarter"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals(
        "Cannot sort by quarter (expected one of [changedAt, id, newValue, oldValue,"
            + " recruitmentId, whatChanged])",
        json.get("message"));
    verify(repository, never()).findByRecruitmentId(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_direction_that_is_not_asc_or_desc_is_a_400() throws Exception {
    mockMvc
        .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=7&direction=sideways"))
        .andExpect(status().isBadRequest());
    verify(repository, never()).findByRecruitmentId(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_recruitment_with_no_rows_gets_an_empty_page() throws Exception {
    when(repository.findByRecruitmentId(eq(99L), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitmentaudittrail/all?recruitmentId=99"))
            .andExpect(status().isOk())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals(0, json.get("totalElements"));
    assertEquals(0, json.get("totalPages"));
    assertEquals(List.of(), json.get("content"));
  }
}
