package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.opencsv.CSVReader;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.RankingsCsvService;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminRankingsController.class)
@Import({RankingsCsvService.class, AssignmentsService.class})
class AdminRankingsControllerTests extends ControllerTestCase {
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean CandidateRankingRepository candidateRankingRepository;

  @Test
  void logged_out_cannot_download_rankings() throws Exception {
    forbidden();
  }

  @Test
  @WithMockUser(roles = "USER")
  void applicants_cannot_download_rankings() throws Exception {
    forbidden();
  }

  @Test
  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  void instructors_cannot_download_rankings() throws Exception {
    forbidden();
  }

  private void forbidden() throws Exception {
    mockMvc
        .perform(get("/api/admin/rankings/csv?recruitmentId=7"))
        .andExpect(status().isForbidden());
    verify(recruitmentRepository, never()).findById(any());
    verify(applicationRepository, never()).findByRecruitmentIdOrderByIdAsc(any());
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(any());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void missing_recruitment_is_explicit_404_without_reading_applicants_or_ranks() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());
    MvcResult result =
        mockMvc
            .perform(get("/api/admin/rankings/csv?recruitmentId=99"))
            .andExpect(status().isNotFound())
            .andReturn();
    assertEquals("Recruitment with id 99 not found", responseToJson(result).get("message"));
    verify(applicationRepository, never()).findByRecruitmentIdOrderByIdAsc(any());
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(any());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void download_is_utf8_csv_attachment_scoped_to_requested_recruitment() throws Exception {
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(Recruitment.builder().id(7L).type(RecruitmentType.TA).build()));
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(
                RecruitmentCourse.builder()
                    .id(10L)
                    .recruitmentId(7L)
                    .courseId("CMPSC 16")
                    .section("0100")
                    .enrollCode("100")
                    .removed(true)
                    .build()));
    when(candidateRankingRepository.findByRecruitmentCourseId(10L))
        .thenReturn(
            List.of(
                CandidateRanking.builder()
                    .recruitmentCourseId(10L)
                    .applicationId(1L)
                    .rank(3)
                    .build(),
                CandidateRanking.builder()
                    .recruitmentCourseId(10L)
                    .applicationId(999L)
                    .rank(1)
                    .build()));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                Application.builder()
                    .id(1L)
                    .recruitmentId(7L)
                    .firstName("Zoë,\"星\"\nAda")
                    .lastName("雪")
                    .email("a@ucsb.edu")
                    .major("CS")
                    .classLevel(ClassLevel.MS)
                    .yearInProgram("1")
                    .graduationDate("Spring 2027")
                    .adminComments("PRIVATE")
                    .build(),
                Application.builder().id(2L).recruitmentId(7L).testApplication(true).build(),
                Application.builder()
                    .id(3L)
                    .recruitmentId(7L)
                    .email("unranked@ucsb.edu")
                    .tentativeAssignmentId(10L)
                    .build()));
    MvcResult result =
        mockMvc
            .perform(get("/api/admin/rankings/csv?recruitmentId=7"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
            .andExpect(
                header().string("Content-Disposition", "attachment; filename=\"rankings-7.csv\""))
            .andReturn();
    try (CSVReader reader =
        new CSVReader(
            new StringReader(result.getResponse().getContentAsString(StandardCharsets.UTF_8)))) {
      assertEquals(
          List.of(
              List.of(
                  "firstName",
                  "lastName",
                  "email",
                  "major",
                  "classLevel",
                  "yearInProgram",
                  "graduationDate",
                  "tentativeAssignment",
                  "16"),
              List.of("Allocation", "", "", "", "", "", "", "", "0"),
              List.of("Assigned", "", "", "", "", "", "", "", "1"),
              List.of("Left to assign", "", "", "", "", "", "", "", "-1"),
              List.of("Zoë,\"星\"\nAda", "雪", "a@ucsb.edu", "CS", "MS", "1", "Spring 2027", "", "3"),
              List.of("", "", "unranked@ucsb.edu", "", "", "", "", "16", "")),
          reader.readAll().stream().map(Arrays::asList).toList());
    }
    verify(applicationRepository).findByRecruitmentIdOrderByIdAsc(7L);
    verify(recruitmentCourseRepository).findByRecruitmentId(7L);
    verify(candidateRankingRepository).findByRecruitmentCourseId(10L);
    verify(candidateRankingRepository, never()).findAll();
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void empty_ula_download_has_exact_header_and_its_own_filename() throws Exception {
    when(recruitmentRepository.findById(8L))
        .thenReturn(Optional.of(Recruitment.builder().id(8L).type(RecruitmentType.ULA).build()));
    MvcResult result =
        mockMvc
            .perform(get("/api/admin/rankings/csv?recruitmentId=8"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
            .andExpect(
                header().string("Content-Disposition", "attachment; filename=\"rankings-8.csv\""))
            .andReturn();
    assertEquals(
        "\"firstName\",\"lastName\",\"email\",\"major\",\"yearInProgram\",\"graduationDate\","
            + "\"gpaMajor\",\"gpaOverall\",\"previousServiceAsUla\",\"tentativeAssignment\"\n"
            + "\"Allocation\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n"
            + "\"Assigned\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n"
            + "\"Left to assign\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"\n",
        result.getResponse().getContentAsString());
  }
}
