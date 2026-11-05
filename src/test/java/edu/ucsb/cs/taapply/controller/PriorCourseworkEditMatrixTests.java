package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.services.fake.FakeApplicationGenerator;
import edu.ucsb.cs.taapply.services.fake.FakeCoursework;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Issues #323 and #324: every way of changing the prior coursework of an application (add a course,
 * change a grade, change a term, delete a course) through every save path (a new draft, a saved
 * draft, a submitted application as its owner, and a submitted application as an admin), for TA and
 * ULA applications, against the real schema, so column limits, ordering and orphan removal are all
 * exercised. An admin edit must also leave the right rows in the audit trail.
 *
 * <p>An admin has no way to edit someone's draft (the admin pages only read drafts and comment on
 * them), so there is no such path to test.
 */
@SpringBootTest
@AutoConfigureMockMvc
public class PriorCourseworkEditMatrixTests extends ControllerTestCase {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired NoticeVersionRepository noticeVersionRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired DraftApplicationRepository draftApplicationRepository;
  @Autowired AuditTrailRepository auditTrailRepository;

  /**
   * The database is shared with the other tests of the run (some of which expect empty tables), so
   * everything this class commits is deleted again, children first.
   */
  @AfterEach
  void deleteWhatWasCreated() {
    auditTrailRepository.deleteAll();
    draftApplicationRepository.deleteAll();
    applicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
    noticeVersionRepository.deleteAll();
  }

  enum Path {
    NEW_DRAFT,
    SAVED_DRAFT,
    SUBMITTED_BY_OWNER,
    SUBMITTED_BY_ADMIN
  }

  static Stream<Arguments> cases() {
    return Stream.of(RecruitmentType.TA, RecruitmentType.ULA)
        .flatMap(type -> Stream.of(Path.values()).map(path -> Arguments.of(type, path)));
  }

  private static Map<String, Object> course(
      String number, String term, String grade, boolean ucsb, String school) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("ucsbCourse", ucsb);
    row.put("otherSchool", school);
    row.put("courseNumber", number);
    row.put("courseTitle", null);
    row.put("term", term);
    row.put("grade", grade);
    return row;
  }

  private static String key(Map<String, Object> row) {
    return String.join(
        "|",
        String.valueOf(row.get("ucsbCourse")),
        String.valueOf(row.get("otherSchool")),
        String.valueOf(row.get("courseNumber")),
        String.valueOf(row.get("term")),
        String.valueOf(row.get("grade")));
  }

  private static String key(PriorCoursework c) {
    return key(
        course(
            c.getCourseNumber(), c.getTerm(), c.getGrade(), c.isUcsbCourse(), c.getOtherSchool()));
  }

  /** The valid answers of a fake application of this type, from the generator the job uses. */
  private ObjectNode validAnswers(RecruitmentType type, Long noticeId) {
    TaTopicRepository taTopics = mock(TaTopicRepository.class);
    UlaTopicRepository ulaTopics = mock(UlaTopicRepository.class);
    UlaInterestRepository ulaInterests = mock(UlaInterestRepository.class);
    when(taTopics.findAll()).thenReturn(List.of(TaTopic.builder().name("Python").build()));
    when(ulaTopics.findAll()).thenReturn(List.of(UlaTopic.builder().name("Git").build()));
    when(ulaInterests.findAll()).thenReturn(List.of(UlaInterest.builder().name("Grading").build()));
    FakeApplicationGenerator generator =
        new FakeApplicationGenerator(
            new FakeCoursework(),
            mock(CourseRepository.class),
            taTopics,
            ulaTopics,
            ulaInterests,
            mock(TaMajorRepository.class),
            mock(UlaMajorRepository.class));
    Recruitment recruitment = Recruitment.builder().id(1L).quarter("20264").type(type).build();
    Application fake =
        generator
            .generate(
                recruitment,
                List.of("CMPSC   16", "CMPSC  156", "CMPSC  170"),
                1,
                FakeCoverage.ALL,
                new Random(11),
                new HashSet<>(),
                LocalDate.of(2026, 2, 10))
            .get(0);
    ApplicationFields fields = FakeApplicationsRuleComplianceTests.fieldsOf(fake);
    ObjectNode node = mapper.valueToTree(fields);
    node.put("noticeVersionId", noticeId);
    return node;
  }

  private List<Map<String, Object>> rowsOf(ObjectNode answers) {
    List<Map<String, Object>> rows = new ArrayList<>();
    for (JsonNode row : answers.get("priorCoursework")) {
      rows.add(
          course(
              row.path("courseNumber").asText(),
              row.path("term").isNull() ? null : row.path("term").asText(),
              row.path("grade").isNull() ? null : row.path("grade").asText(),
              row.path("ucsbCourse").asBoolean(),
              row.path("otherSchool").isNull() ? null : row.path("otherSchool").asText()));
    }
    return rows;
  }

  private String body(ObjectNode answers, List<Map<String, Object>> rows) throws Exception {
    ObjectNode copy = answers.deepCopy();
    ArrayNode array = copy.putArray("priorCoursework");
    rows.forEach(r -> array.add(mapper.valueToTree(r)));
    return mapper.writeValueAsString(copy);
  }

  private MockHttpServletRequestBuilder as(
      MockHttpServletRequestBuilder request, String username, boolean admin) {
    return request
        .with(admin ? user(username).roles("USER", "ADMIN") : user(username).roles("USER"))
        .with(csrf())
        .contentType(MediaType.APPLICATION_JSON);
  }

  private JsonNode send(MockHttpServletRequestBuilder request) throws Exception {
    MvcResult result = mockMvcPerform(request);
    return mapper.readTree(result.getResponse().getContentAsString());
  }

  private MvcResult mockMvcPerform(MockHttpServletRequestBuilder request) throws Exception {
    return mockMvc.perform(request).andExpect(status().isOk()).andReturn();
  }

  private void check(RecruitmentType type, Path path) throws Exception {
    String who = (type + "-" + path).toLowerCase();
    String email = who + "@example.org";
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                // One recruitment per quarter and type, and the database keeps its rows between
                // tests, so each path gets a quarter of its own.
                .quarter("2027" + (path.ordinal() + 1))
                .type(type)
                .applicationStatus(ApplicationStatus.OPEN)
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.now().plusDays(30))
                .actualOpeningDate(LocalDate.of(2026, 9, 1))
                .build());
    NoticeVersion notice =
        noticeVersionRepository.save(
            NoticeVersion.builder()
                .type(type)
                .content("Terms")
                .createdAt(LocalDateTime.now().plusMinutes(type == RecruitmentType.TA ? 1 : 2))
                .build());
    ObjectNode answers = validAnswers(type, notice.getId());
    List<Map<String, Object>> rows = path == Path.NEW_DRAFT ? new ArrayList<>() : rowsOf(answers);

    // The way in: a draft is opened (and for a saved one, saved once), an application submitted.
    Long id;
    String applicationsUrl = "/api/applications";
    if (path == Path.NEW_DRAFT || path == Path.SAVED_DRAFT) {
      JsonNode opened =
          send(
              as(
                  post("/api/draftApplications/open?recruitmentId=" + recruitment.getId()),
                  who,
                  false));
      id = opened.get("id").asLong();
      if (path == Path.SAVED_DRAFT) {
        draftSave(id, who, answers, rows);
      }
    } else {
      JsonNode posted =
          send(
              as(post(applicationsUrl + "/post?recruitmentId=" + recruitment.getId()), who, false)
                  .content(body(answers, rows)));
      id = posted.get("id").asLong();
    }

    String grade = "B+";
    String term = "W26";
    List<Consumer<List<Map<String, Object>>>> edits =
        List.of(
            // 1. add a brand new course
            r -> r.add(course("CMPSC 190", "F25", "A", true, null)),
            // 2. edit the grade of an existing course
            r -> r.get(0).put("grade", grade),
            // 3. edit the term of an existing course
            r -> r.get(0).put("term", term),
            // 4. delete an existing course
            r -> r.remove(path == Path.NEW_DRAFT ? 0 : r.size() - 1));
    String[] names = {"add", "grade", "term", "delete"};

    for (int i = 0; i < edits.size(); i++) {
      List<String> auditBefore = auditTexts(id);
      List<Map<String, Object>> before = copy(rows);
      edits.get(i).accept(rows);
      String step = type + " " + path + " " + names[i];

      switch (path) {
        case NEW_DRAFT, SAVED_DRAFT -> draftSave(id, who, answers, rows);
        case SUBMITTED_BY_OWNER ->
            send(
                as(
                        put(
                            applicationsUrl
                                + "?id="
                                + id
                                + "&version="
                                + applicationRepository.findById(id).orElseThrow().getVersion()),
                        who,
                        false)
                    .content(body(answers, rows)));
        case SUBMITTED_BY_ADMIN ->
            send(
                as(
                        put(
                            "/api/admin/applications?id="
                                + id
                                + "&version="
                                + applicationRepository.findById(id).orElseThrow().getVersion()),
                        "boss",
                        true)
                    .content(body(answers, rows)));
      }

      List<PriorCoursework> stored =
          path == Path.NEW_DRAFT || path == Path.SAVED_DRAFT
              ? draftApplicationRepository.findById(id).orElseThrow().getPriorCoursework()
              : applicationRepository.findById(id).orElseThrow().getPriorCoursework();
      assertEquals(
          rows.stream().map(PriorCourseworkEditMatrixTests::key).toList(),
          stored.stream().map(PriorCourseworkEditMatrixTests::key).toList(),
          step);

      if (path == Path.SUBMITTED_BY_ADMIN) {
        // The audit trail gains exactly the rows of this change: a row gone, a row added.
        List<String> added = auditTexts(id);
        added.removeAll(auditBefore);
        List<String> expected = new ArrayList<>();
        switch (i) {
          case 0 -> expected.add("null -> " + json(rows.get(rows.size() - 1)));
          case 1, 2 -> {
            expected.add(json(before.get(0)) + " -> null");
            expected.add("null -> " + json(rows.get(0)));
          }
          default -> expected.add(json(before.get(before.size() - 1)) + " -> null");
        }
        assertEquals(expected.stream().sorted().toList(), added.stream().sorted().toList(), step);
      }
    }
    if (path == Path.SUBMITTED_BY_ADMIN) {
      checkColumnSizes(id, answers, rows);
    }
  }

  /** Values the size of their columns are stored; one character more is a 400, not a 500. */
  private void checkColumnSizes(Long id, ObjectNode answers, List<Map<String, Object>> rows)
      throws Exception {
    rows.get(0).put("grade", "g".repeat(16));
    rows.get(0).put("term", "t".repeat(64));
    rows.get(0).put("courseTitle", "c".repeat(255));
    send(
        as(
                put(
                    "/api/admin/applications?id="
                        + id
                        + "&version="
                        + applicationRepository.findById(id).orElseThrow().getVersion()),
                "boss",
                true)
            .content(body(answers, rows)));
    PriorCoursework stored =
        applicationRepository.findById(id).orElseThrow().getPriorCoursework().get(0);
    assertEquals("g".repeat(16), stored.getGrade());
    assertEquals("t".repeat(64), stored.getTerm());
    assertEquals("c".repeat(255), stored.getCourseTitle());

    for (String[] tooLong :
        new String[][] {{"grade", "17"}, {"term", "65"}, {"courseTitle", "256"}}) {
      List<Map<String, Object>> bad = copy(rows);
      bad.get(0).put(tooLong[0], "x".repeat(Integer.parseInt(tooLong[1])));
      mockMvc
          .perform(
              as(
                      put(
                          "/api/admin/applications?id="
                              + id
                              + "&version="
                              + applicationRepository.findById(id).orElseThrow().getVersion()),
                      "boss",
                      true)
                  .content(body(answers, bad)))
          .andExpect(status().isBadRequest());
    }
    assertEquals(
        "g".repeat(16),
        applicationRepository.findById(id).orElseThrow().getPriorCoursework().get(0).getGrade());
  }

  private void draftSave(Long id, String who, ObjectNode answers, List<Map<String, Object>> rows)
      throws Exception {
    DraftApplication draft = draftApplicationRepository.findById(id).orElseThrow();
    send(
        as(put("/api/draftApplications?id=" + id + "&version=" + draft.getVersion()), who, false)
            .content(body(answers, rows)));
  }

  private static List<Map<String, Object>> copy(List<Map<String, Object>> rows) {
    List<Map<String, Object>> copy = new ArrayList<>();
    rows.forEach(r -> copy.add(new LinkedHashMap<>(r)));
    return copy;
  }

  private String json(Map<String, Object> row) {
    return mapper.valueToTree(row).toString();
  }

  /** The prior coursework audit rows of the application, as "old -> new" in JSON. */
  private List<String> auditTexts(Long id) {
    List<String> texts = new ArrayList<>();
    for (AuditTrail row : auditTrailRepository.findByTaApplicationIdOrderByIdAsc(id)) {
      if ("priorCoursework".equals(row.getFieldName())) {
        texts.add(row.getOldValue() + " -> " + row.getNewValue());
      }
    }
    for (AuditTrail row : auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(id)) {
      if ("priorCoursework".equals(row.getFieldName())) {
        texts.add(row.getOldValue() + " -> " + row.getNewValue());
      }
    }
    return texts;
  }

  @ParameterizedTest(name = "{0} {1}")
  @MethodSource("cases")
  void every_edit_of_the_prior_coursework_is_saved_and_an_admin_s_is_audited(
      RecruitmentType type, Path path) throws Exception {
    check(type, path);
  }
}
