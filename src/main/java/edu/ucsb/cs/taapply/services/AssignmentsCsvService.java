package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The admin Assignments page's table as a CSV (issue #475): the same applicants in the same order,
 * the identity columns headed as the page heads them, the Tentative Assignment, then one column per
 * lecture holding the rank its instructor gave the applicant (blank when unranked). A lecture
 * column is headed by the bare course number, with the section only when the page has more than one
 * section of that course, as the rankings CSV heads its columns; the allocation, assigned and To
 * Assign counts of the page's headings are left out.
 */
@Service
public class AssignmentsCsvService {
  @Autowired AssignmentsService assignmentsService;

  /** How the page heads each identity column (assignments.ts on the frontend). */
  static final Map<String, String> IDENTITY_LABELS =
      Map.ofEntries(
          Map.entry("firstName", "First Name"),
          Map.entry("lastName", "Last Name"),
          Map.entry("email", "Email"),
          Map.entry("major", "Major"),
          Map.entry("classLevel", "Class Level"),
          Map.entry("yearInProgram", "Year in Program"),
          Map.entry("graduationDate", "Graduation Date"),
          Map.entry("gpaMajor", "GPA (Major)"),
          Map.entry("gpaOverall", "GPA (Overall)"),
          Map.entry("previousServiceAsUla", "Previous ULA Quarters"));

  /** The heading of the Tentative Assignment column, as on the page. */
  static final String TENTATIVE_HEADER = "Tentative Assignment";

  /** A heading for an identity field; a field with no label of its own is headed by its name. */
  static String identityLabel(String header) {
    return IDENTITY_LABELS.getOrDefault(header, header);
  }

  /** The table as CSV: the header row, then a row per applicant, every cell quoted. */
  public String csv(Recruitment recruitment) {
    Assignments page = assignmentsService.assignments(recruitment);
    // The headings need only what the page's summaries carry: the section rule looks at the
    // lectures on the page, so a removed lecture the page leaves out does not force a section
    // onto the heading of the one still offered.
    Map<Long, String> headings =
        AssignmentsService.headings(
            page.courses().stream()
                .map(
                    (CourseSummary course) ->
                        RecruitmentCourse.builder()
                            .id(course.id())
                            .courseId(course.courseId())
                            .section(course.section())
                            .enrollCode(course.enrollCode())
                            .build())
                .toList());

    List<String> header = new ArrayList<>();
    for (String identity : page.identityHeaders()) {
      header.add(identityLabel(identity));
    }
    header.add(TENTATIVE_HEADER);
    for (CourseSummary course : page.courses()) {
      header.add(headings.get(course.id()));
    }

    StringWriter out = new StringWriter();
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(header.toArray(String[]::new));
    for (AssignmentRow row : page.rows()) {
      List<String> cells = new ArrayList<>();
      for (String identity : page.identityHeaders()) {
        cells.add(ApplicationCsvService.text(row.identity().get(identity)));
      }
      cells.add(ApplicationCsvService.text(headings.get(row.tentativeAssignment())));
      for (CourseSummary course : page.courses()) {
        cells.add(ApplicationCsvService.text(row.rankings().get(course.id())));
      }
      writer.writeNext(cells.toArray(String[]::new));
    }
    return out.toString();
  }
}
