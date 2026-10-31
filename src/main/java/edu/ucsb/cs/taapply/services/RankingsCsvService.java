package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService.IdentityColumn;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * A historical snapshot of faculty rankings, not just currently offered courses.
 *
 * <p>Since issue #179 the file also carries the admin's planning: a {@code tentativeAssignment}
 * column after the identity columns, and three rows directly under the header, labelled in the
 * first column, with each section's allocation, how many applicants are tentatively assigned to it
 * and how many places are left.
 */
@Service
public class RankingsCsvService {
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired AssignmentsService assignmentsService;

  /** Labels, in the first column, of the three planning rows under the header. */
  static final String ALLOCATION_ROW = "Allocation";

  static final String ASSIGNED_ROW = "Assigned";
  static final String LEFT_ROW = "Left to assign";

  private record Column(String header, Function<Application, Object> value) {}

  public String write(Recruitment recruitment) {
    List<Column> columns = new ArrayList<>();
    for (IdentityColumn identity : AssignmentsService.identityColumns(recruitment.getType())) {
      columns.add(new Column(identity.header(), identity.value()));
    }
    // Do not filter on isOnOffer: removed/stale/cancelled sections retain their rankings.
    List<RecruitmentCourse> courses =
        new ArrayList<>(recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()));
    courses.sort(AssignmentsService.BY_COURSE_SECTION_ENROLL);
    Map<Long, String> labels = new HashMap<>();
    for (RecruitmentCourse course : courses) {
      labels.put(course.getId(), AssignmentsService.label(course));
    }
    columns.add(new Column("tentativeAssignment", a -> labels.get(a.getTentativeAssignmentId())));

    List<Application> applications =
        applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId());
    // Counted like the Assignments page: real, uncancelled applicants only.
    Map<Long, Integer> assigned =
        AssignmentsService.assignedCounts(AssignmentsService.real(applications));
    String[] allocationRow = planningRow(ALLOCATION_ROW, columns.size() + courses.size());
    String[] assignedRow = planningRow(ASSIGNED_ROW, allocationRow.length);
    String[] leftRow = planningRow(LEFT_ROW, allocationRow.length);
    for (RecruitmentCourse course : courses) {
      Map<Long, Integer> ranks = assignmentsService.ranksFor(course);
      int column = columns.size();
      int count = assigned.getOrDefault(course.getId(), 0);
      allocationRow[column] = String.valueOf(course.getAllocation());
      assignedRow[column] = String.valueOf(count);
      leftRow[column] = String.valueOf(course.getAllocation() - count);
      columns.add(new Column(labels.get(course.getId()), a -> ranks.get(a.getId())));
    }

    StringWriter out = new StringWriter();
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(columns.stream().map(Column::header).toArray(String[]::new));
    writer.writeNext(allocationRow);
    writer.writeNext(assignedRow);
    writer.writeNext(leftRow);
    for (Application application : applications) {
      if (!application.isTestApplication()) {
        writer.writeNext(
            columns.stream()
                .map(c -> ApplicationCsvService.text(c.value().apply(application)))
                .toArray(String[]::new));
      }
    }
    return out.toString();
  }

  /** A row of the given width, blank except for its label in the first column. */
  private static String[] planningRow(String label, int width) {
    String[] row = new String[width];
    Arrays.fill(row, "");
    row[0] = label;
    return row;
  }
}
