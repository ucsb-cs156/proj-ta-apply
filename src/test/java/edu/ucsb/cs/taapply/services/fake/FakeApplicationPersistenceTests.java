package edu.ucsb.cs.taapply.services.fake;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** Generated applications are real rows: they save, reload whole, and delete cleanly. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class FakeApplicationPersistenceTests {

  @Autowired RecruitmentRepository recruitments;
  @Autowired ApplicationRepository applications;
  @Autowired CourseRepository courses;
  @Autowired TaTopicRepository taTopics;
  @Autowired UlaTopicRepository ulaTopics;
  @Autowired UlaInterestRepository ulaInterests;
  @Autowired TaMajorRepository taMajors;
  @Autowired UlaMajorRepository ulaMajors;
  @Autowired TestEntityManager entityManager;

  private static final List<String> COURSES = List.of("CMPSC   16", "CMPSC  156");

  private FakeApplicationGenerator generator() {
    return new FakeApplicationGenerator(
        new FakeCoursework(), courses, taTopics, ulaTopics, ulaInterests, taMajors, ulaMajors);
  }

  @Test
  void generated_applications_save_reload_and_delete() {
    taTopics.save(TaTopic.builder().name("Python").build());
    ulaInterests.save(UlaInterest.builder().name("Grading").build());
    for (RecruitmentType type : RecruitmentType.values()) {
      Recruitment recruitment =
          recruitments.save(Recruitment.builder().quarter("20261").type(type).build());
      List<Application> made =
          generator()
              .generate(
                  recruitment,
                  COURSES,
                  25,
                  FakeCoverage.ALL,
                  new Random(8),
                  new HashSet<>(),
                  java.time.LocalDate.of(2026, 2, 10));

      applications.saveAll(made);
      entityManager.flush();
      entityManager.clear();

      List<Application> loaded = applications.findByRecruitmentIdOrderByIdAsc(recruitment.getId());
      assertEquals(25, loaded.size());
      for (Application a : loaded) {
        assertEquals(ApplicationOrigin.DEVELOPER_MODE, a.getOrigin());
        assertFalse(a.getPriorCoursework().isEmpty());
        assertTrue(a.getEmail().endsWith("@fake.ucsb.edu"));
      }
      assertEquals(
          made.stream().map(Application::getEmail).sorted().toList(),
          loaded.stream().map(Application::getEmail).sorted().toList());

      applications.deleteAll(loaded);
      entityManager.flush();
      assertTrue(applications.findByRecruitmentIdOrderByIdAsc(recruitment.getId()).isEmpty());
    }
  }
}
