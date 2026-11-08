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
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentAuditTrail;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentAuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  private static RecruitmentAuditTrail row(long id, String what, String oldValue, String newValue) {
    return row(id, 7L, what, oldValue, newValue);
  }

  private static RecruitmentAuditTrail row(
      long id, long recruitmentId, String what, String oldValue, String newValue) {
    return RecruitmentAuditTrail.builder()
        .id(id)
        .changedAt(LocalDateTime.of(2026, 1, 6, 9, 30))
        .recruitmentId(recruitmentId)
        .whatChanged(what)
        .oldValue(oldValue)
        .newValue(newValue)
        .editorEmail("admin@ucsb.edu")
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
        List.of(
            "changedAt",
            "editorEmail",
            "id",
            "newValue",
            "oldValue",
            "recruitmentId",
            "whatChanged"),
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
        "Cannot sort by quarter (expected one of [changedAt, editorEmail, id, newValue, oldValue,"
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

  // ---- GET /hiringTargets (issue #391): the Budget page's Audit Trail card ----

  private static final String HIRING_TARGETS_URL =
      "/api/admin/recruitmentaudittrail/hiringTargets?quarter=20264";

  private static Recruitment recruitment(long id, RecruitmentType type) {
    return Recruitment.builder().id(id).quarter("20264").type(type).build();
  }

  /** The quarter has both recruitments: TA is 5, ULA is 6. */
  private void quarterHasBothRecruitments() {
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.TA))
        .thenReturn(Optional.of(recruitment(5L, RecruitmentType.TA)));
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.ULA))
        .thenReturn(Optional.of(recruitment(6L, RecruitmentType.ULA)));
  }

  @Test
  public void logged_out_users_cannot_read_the_hiring_target_changes() throws Exception {
    mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().is(403));
    verify(repository, never()).findByRecruitmentIdInAndWhatChanged(any(), any(), any());
    verify(recruitmentRepository, never()).findByQuarterAndType(any(), any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_read_the_hiring_target_changes() throws Exception {
    mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().is(403));
    verify(repository, never()).findByRecruitmentIdInAndWhatChanged(any(), any(), any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_the_hiring_target_changes() throws Exception {
    mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().is(403));
    verify(repository, never()).findByRecruitmentIdInAndWhatChanged(any(), any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_hiring_target_changes_of_both_recruitments_come_newest_first_each_with_its_type()
      throws Exception {
    quarterHasBothRecruitments();
    List<RecruitmentAuditTrail> rows =
        List.of(
            row(12L, 6L, "totalHiringTarget", "1", "10"),
            row(11L, 5L, "totalHiringTarget", "8", "9"),
            row(9L, 5L, "totalHiringTarget", "1", "8"));
    when(repository.findByRecruitmentIdInAndWhatChanged(any(), eq("totalHiringTarget"), any()))
        .thenReturn(new PageImpl<>(rows, PageRequest.of(0, 10), 3));

    MvcResult response =
        mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().isOk()).andReturn();

    // Only the totalHiringTarget rows of the quarter's two recruitments are asked for.
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<Long>> ids = ArgumentCaptor.forClass(Collection.class);
    ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
    verify(repository, times(1))
        .findByRecruitmentIdInAndWhatChanged(
            ids.capture(), eq(RecruitmentAuditTrailController.HIRING_TARGET), pageable.capture());
    assertEquals(Set.of(5L, 6L), Set.copyOf(ids.getValue()));
    assertEquals("totalHiringTarget", RecruitmentAuditTrailController.HIRING_TARGET);
    assertEquals(0, pageable.getValue().getPageNumber());
    assertEquals(10, pageable.getValue().getPageSize());
    assertEquals(Sort.by(Sort.Direction.DESC, "id"), pageable.getValue().getSort());

    RecruitmentAuditTrailController.HiringTargetAuditTrailPageDTO expected =
        new RecruitmentAuditTrailController.HiringTargetAuditTrailPageDTO(
            List.of(
                new RecruitmentAuditTrailController.HiringTargetChangeDTO(
                    rows.get(0), RecruitmentType.ULA),
                new RecruitmentAuditTrailController.HiringTargetChangeDTO(
                    rows.get(1), RecruitmentType.TA),
                new RecruitmentAuditTrailController.HiringTargetChangeDTO(
                    rows.get(2), RecruitmentType.TA)),
            0,
            10,
            3,
            1);
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());

    Map<String, Object> json = responseToJson(response);
    assertEquals(0, json.get("number"));
    assertEquals(10, json.get("size"));
    assertEquals(3, json.get("totalElements"));
    assertEquals(1, json.get("totalPages"));
    List<?> content = (List<?>) json.get("content");
    assertEquals(3, content.size());
    // Each row is the trail's row with the recruitment's type beside it.
    Map<?, ?> first = (Map<?, ?>) content.get(0);
    assertEquals(12, first.get("id"));
    assertEquals("2026-01-06T09:30:00", first.get("changedAt"));
    assertEquals(6, first.get("recruitmentId"));
    assertEquals("totalHiringTarget", first.get("whatChanged"));
    assertEquals("1", first.get("oldValue"));
    assertEquals("10", first.get("newValue"));
    assertEquals("admin@ucsb.edu", first.get("editorEmail"));
    assertEquals("ULA", first.get("type"));
    assertEquals("TA", ((Map<?, ?>) content.get(1)).get("type"));
    assertEquals(5, ((Map<?, ?>) content.get(2)).get("recruitmentId"));
    assertEquals("TA", ((Map<?, ?>) content.get(2)).get("type"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_quarter_with_one_recruitment_asks_for_that_one_s_rows_only() throws Exception {
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.TA))
        .thenReturn(Optional.empty());
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.ULA))
        .thenReturn(Optional.of(recruitment(6L, RecruitmentType.ULA)));
    List<RecruitmentAuditTrail> rows = List.of(row(12L, 6L, "totalHiringTarget", "1", "10"));
    when(repository.findByRecruitmentIdInAndWhatChanged(any(), eq("totalHiringTarget"), any()))
        .thenReturn(new PageImpl<>(rows, PageRequest.of(0, 10), 1));

    MvcResult response =
        mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().isOk()).andReturn();

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Collection<Long>> ids = ArgumentCaptor.forClass(Collection.class);
    verify(repository).findByRecruitmentIdInAndWhatChanged(ids.capture(), any(), any());
    assertEquals(Set.of(6L), Set.copyOf(ids.getValue()));
    Map<String, Object> json = responseToJson(response);
    assertEquals(1, json.get("totalElements"));
    assertEquals("ULA", ((Map<?, ?>) ((List<?>) json.get("content")).get(0)).get("type"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_hiring_target_page_size_sort_and_direction_are_passed_through() throws Exception {
    quarterHasBothRecruitments();
    when(repository.findByRecruitmentIdInAndWhatChanged(any(), any(), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(2, 5), 0));

    mockMvc
        .perform(get(HIRING_TARGETS_URL + "&page=2&size=5&sort=changedAt&direction=asc"))
        .andExpect(status().isOk());

    ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
    verify(repository, times(1))
        .findByRecruitmentIdInAndWhatChanged(any(), any(), captor.capture());
    Pageable pageable = captor.getValue();
    assertEquals(2, pageable.getPageNumber());
    assertEquals(5, pageable.getPageSize());
    assertEquals(Sort.by(Sort.Direction.ASC, "changedAt"), pageable.getSort());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_hiring_target_changes_can_be_sorted_by_every_column_and_by_nothing_else()
      throws Exception {
    quarterHasBothRecruitments();
    when(repository.findByRecruitmentIdInAndWhatChanged(any(), any(), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));
    for (String column : RecruitmentAuditTrailController.SORTABLE) {
      mockMvc.perform(get(HIRING_TARGETS_URL + "&sort=" + column)).andExpect(status().isOk());
    }

    MvcResult response =
        mockMvc
            .perform(get(HIRING_TARGETS_URL + "&sort=type"))
            .andExpect(status().isBadRequest())
            .andReturn();
    assertEquals(
        "Cannot sort by type (expected one of [changedAt, editorEmail, id, newValue, oldValue,"
            + " recruitmentId, whatChanged])",
        responseToJson(response).get("message"));
    mockMvc
        .perform(get(HIRING_TARGETS_URL + "&direction=sideways"))
        .andExpect(status().isBadRequest());
    // The bad requests were refused before anything was looked up.
    verify(repository, times(RecruitmentAuditTrailController.SORTABLE.size()))
        .findByRecruitmentIdInAndWhatChanged(any(), any(), any());
    verify(recruitmentRepository, times(RecruitmentAuditTrailController.SORTABLE.size()))
        .findByQuarterAndType("20264", RecruitmentType.TA);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_quarter_with_no_recruitment_gets_an_empty_page_without_a_lookup() throws Exception {
    when(recruitmentRepository.findByQuarterAndType(any(), any())).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                get("/api/admin/recruitmentaudittrail/hiringTargets?quarter=20271&page=0&size=25"))
            .andExpect(status().isOk())
            .andReturn();

    verify(recruitmentRepository).findByQuarterAndType("20271", RecruitmentType.TA);
    verify(recruitmentRepository).findByQuarterAndType("20271", RecruitmentType.ULA);
    verify(repository, never()).findByRecruitmentIdInAndWhatChanged(any(), any(), any());
    Map<String, Object> json = responseToJson(response);
    assertEquals(List.of(), json.get("content"));
    assertEquals(0, json.get("number"));
    assertEquals(25, json.get("size"));
    assertEquals(0, json.get("totalElements"));
    assertEquals(0, json.get("totalPages"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_quarter_whose_targets_never_changed_gets_an_empty_page() throws Exception {
    quarterHasBothRecruitments();
    when(repository.findByRecruitmentIdInAndWhatChanged(any(), any(), any()))
        .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

    MvcResult response =
        mockMvc.perform(get(HIRING_TARGETS_URL)).andExpect(status().isOk()).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals(List.of(), json.get("content"));
    assertEquals(0, json.get("totalElements"));
    assertEquals(0, json.get("totalPages"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_hiring_target_changes_need_a_quarter() throws Exception {
    mockMvc
        .perform(get("/api/admin/recruitmentaudittrail/hiringTargets"))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findByQuarterAndType(any(), any());
  }
}
