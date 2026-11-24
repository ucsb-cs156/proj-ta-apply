package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssignmentsCsvServiceTests {
  @Mock AssignmentsService assignmentsService;
  @InjectMocks AssignmentsCsvService service;

  private static final Recruitment RECRUITMENT =
      Recruitment.builder().id(7L).type(RecruitmentType.TA).build();

  private static CourseSummary course(long id, String courseId, String section, String enroll) {
    return new CourseSummary(id, courseId, section, enroll, 2, 1, 1, false);
  }

  /** Identity fields in the page's order, as the page's rows carry them (already text). */
  private static Map<String, String> identity(String first, String last, String email) {
    Map<String, String> fields = new LinkedHashMap<>();
    fields.put("firstName", first);
    fields.put("lastName", last);
    fields.put("email", email);
    fields.put("classLevel", "PHD");
    return fields;
  }

  @Test
  void csv_is_the_page_table_with_the_page_headings_and_ranks_only() {
    // Two sections of CMPSC 16 on the page, so they are headed with their sections; CMPSC 8 has
    // one, so it is headed by the bare number. The order is the page's.
    Assignments page =
        new Assignments(
            7L,
            RecruitmentType.TA,
            List.of("firstName", "lastName", "email", "classLevel"),
            List.of(
                course(10L, "CMPSC     8", "0100", "100"),
                course(20L, "CMPSC    16", "0100", "200"),
                course(30L, "CMPSC    16", "0200", "300")),
            List.of(
                new AssignmentRow(
                    1L,
                    identity("Ada", "Lovelace", "ada@ucsb.edu"),
                    10L,
                    Map.of(10L, 1, 30L, 2),
                    Map.of(10L, "1st Choice")),
                new AssignmentRow(
                    2L, identity("Grace", "Hopper", "grace@ucsb.edu"), null, Map.of(), Map.of()),
                new AssignmentRow(
                    3L,
                    identity("Alan", "Turing", "alan@ucsb.edu"),
                    20L,
                    Map.of(20L, 1),
                    Map.of(20L, "Enthusiastic"))),
            3);
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(page);

    String csv = service.csv(RECRUITMENT);

    assertEquals(
        "\"First Name\",\"Last Name\",\"Email\",\"Class Level\",\"Tentative Assignment\","
            + "\"8\",\"16 (section 0100)\",\"16 (section 0200)\"\n"
            + "\"Ada\",\"Lovelace\",\"ada@ucsb.edu\",\"PHD\",\"8\",\"1\",\"\",\"2\"\n"
            + "\"Grace\",\"Hopper\",\"grace@ucsb.edu\",\"PHD\",\"\",\"\",\"\",\"\"\n"
            + "\"Alan\",\"Turing\",\"alan@ucsb.edu\",\"PHD\",\"16 (section 0100)\",\"\",\"1\",\"\"\n",
        csv);
  }

  @Test
  void csv_of_a_page_with_no_applicants_is_the_header_alone_and_unknown_fields_keep_their_name() {
    Assignments page =
        new Assignments(
            7L,
            RecruitmentType.ULA,
            List.of("email", "gpaMajor", "gpaOverall", "previousServiceAsUla", "shoeSize"),
            List.of(course(10L, "CMPSC   130A", "0100", "100")),
            List.of(),
            1);
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(page);

    assertEquals(
        "\"Email\",\"GPA (Major)\",\"GPA (Overall)\",\"Previous ULA Quarters\",\"shoeSize\","
            + "\"Tentative Assignment\",\"130A\"\n",
        service.csv(RECRUITMENT));
  }

  @Test
  void every_identity_field_the_page_shows_has_its_label() {
    assertEquals("First Name", AssignmentsCsvService.identityLabel("firstName"));
    assertEquals("Last Name", AssignmentsCsvService.identityLabel("lastName"));
    assertEquals("Email", AssignmentsCsvService.identityLabel("email"));
    assertEquals("Major", AssignmentsCsvService.identityLabel("major"));
    assertEquals("Class Level", AssignmentsCsvService.identityLabel("classLevel"));
    assertEquals("Year in Program", AssignmentsCsvService.identityLabel("yearInProgram"));
    assertEquals("Graduation Date", AssignmentsCsvService.identityLabel("graduationDate"));
    assertEquals("GPA (Major)", AssignmentsCsvService.identityLabel("gpaMajor"));
    assertEquals("GPA (Overall)", AssignmentsCsvService.identityLabel("gpaOverall"));
    assertEquals(
        "Previous ULA Quarters", AssignmentsCsvService.identityLabel("previousServiceAsUla"));
  }
}
