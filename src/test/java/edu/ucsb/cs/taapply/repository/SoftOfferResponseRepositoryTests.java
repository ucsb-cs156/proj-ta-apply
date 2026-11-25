package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.SoftOfferResponse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** Against the Liquibase schema from changeset 075: one answer per (application, lecture). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class SoftOfferResponseRepositoryTests {

  @Autowired TestEntityManager entityManager;
  @Autowired SoftOfferResponseRepository repository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired RecruitmentRepository recruitmentRepository;

  private Long recruitmentId;

  /** Applications need a recruitment to belong to (a foreign key). */
  private Long application(String email) {
    if (recruitmentId == null) {
      recruitmentId =
          recruitmentRepository
              .save(
                  Recruitment.builder()
                      .quarter("20264")
                      .type(RecruitmentType.ULA)
                      .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                      .primaryConsiderationDate(LocalDate.of(2026, 9, 20))
                      .build())
              .getId();
    }
    return applicationRepository
        .save(Application.builder().recruitmentId(recruitmentId).email(email).build())
        .getId();
  }

  private SoftOfferResponse answer(Long applicationId, Long courseId, SoftOfferDecision decision) {
    return repository.save(
        SoftOfferResponse.builder()
            .applicationId(applicationId)
            .recruitmentCourseId(courseId)
            .decision(decision)
            .comments("ok")
            .build());
  }

  @Test
  public void answers_round_trip_are_stamped_and_are_found_by_pair_and_by_applications() {
    Long ada = application("ada@ucsb.edu");
    Long grace = application("grace@ucsb.edu");
    Long alan = application("alan@ucsb.edu");
    SoftOfferResponse first = answer(ada, 10L, SoftOfferDecision.PROCEED);
    // Moved to another lecture and asked again: a second row for the same application.
    answer(ada, 20L, SoftOfferDecision.DECLINE);
    answer(grace, 10L, SoftOfferDecision.DECLINE);
    answer(alan, 10L, SoftOfferDecision.PROCEED);
    entityManager.flush();
    entityManager.clear();

    SoftOfferResponse found =
        repository.findByApplicationIdAndRecruitmentCourseId(ada, 10L).orElseThrow();
    assertEquals(first.getId(), found.getId());
    assertEquals(SoftOfferDecision.PROCEED, found.getDecision());
    assertEquals("ok", found.getComments());
    assertNotNull(found.getRespondedAt());
    assertTrue(repository.findByApplicationIdAndRecruitmentCourseId(grace, 20L).isEmpty());
    assertEquals(3, repository.findByApplicationIdIn(List.of(ada, grace)).size());
    assertEquals(0, repository.findByApplicationIdIn(List.of()).size());
  }

  @Test
  public void an_application_may_answer_for_one_lecture_only_once() {
    Long ada = application("ada@ucsb.edu");
    answer(ada, 10L, SoftOfferDecision.PROCEED);
    entityManager.flush();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          answer(ada, 10L, SoftOfferDecision.DECLINE);
          entityManager.flush();
        });
  }
}
