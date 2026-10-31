package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVWriter;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** A historical snapshot of faculty rankings, not just currently offered courses. */
@Service
public class RankingsCsvService {
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;

  private record Column(String header, Function<Application, Object> value) {}

  private static final List<Column> IDENTITY =
      List.of(
          new Column("firstName", Application::getFirstName),
          new Column("lastName", Application::getLastName),
          new Column("email", Application::getEmail),
          new Column("major", Application::getMajor));

  public String write(Recruitment recruitment) {
    List<Column> columns = new ArrayList<>(IDENTITY);
    if (recruitment.getType() == RecruitmentType.TA) {
      columns.add(new Column("classLevel", Application::getClassLevel));
    }
    columns.add(new Column("yearInProgram", Application::getYearInProgram));
    columns.add(new Column("graduationDate", Application::getGraduationDate));
    if (recruitment.getType() == RecruitmentType.ULA) {
      columns.add(new Column("gpaMajor", Application::getGpaMajor));
      columns.add(new Column("gpaOverall", Application::getGpaOverall));
      columns.add(new Column("previousServiceAsUla", Application::getPreviousServiceAsUla));
    }

    // Do not filter on isOnOffer: removed/stale/cancelled sections retain their rankings.
    List<RecruitmentCourse> courses =
        new ArrayList<>(recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()));
    courses.sort(
        Comparator.comparing((RecruitmentCourse c) -> ApplicationCsvService.text(c.getCourseId()))
            .thenComparing(c -> ApplicationCsvService.text(c.getSection()))
            .thenComparing(c -> ApplicationCsvService.text(c.getEnrollCode())));
    for (RecruitmentCourse course : courses) {
      Map<Long, Integer> ranks = new HashMap<>();
      for (CandidateRanking ranking :
          candidateRankingRepository.findByRecruitmentCourseId(course.getId())) {
        ranks.put(ranking.getApplicationId(), ranking.getRank());
      }
      columns.add(
          new Column(
              "%s (section %s, enroll %s)"
                  .formatted(
                      ApplicationCsvService.text(course.getCourseId()),
                      ApplicationCsvService.text(course.getSection()),
                      ApplicationCsvService.text(course.getEnrollCode())),
              a -> ranks.get(a.getId())));
    }

    StringWriter out = new StringWriter();
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(columns.stream().map(Column::header).toArray(String[]::new));
    for (Application application :
        applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId())) {
      if (!application.isTestApplication()) {
        writer.writeNext(
            columns.stream()
                .map(c -> ApplicationCsvService.text(c.value().apply(application)))
                .toArray(String[]::new));
      }
    }
    return out.toString();
  }
}
