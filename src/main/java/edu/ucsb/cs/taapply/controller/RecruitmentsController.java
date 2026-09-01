package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Admin management of recruitments. */
@Tag(name = "Recruitments")
@RequestMapping("/api/admin/recruitments")
@RestController
@Slf4j
public class RecruitmentsController extends ApiController {

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired JobService jobService;
  @Autowired PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;

  @Operation(
      summary = "Create a recruitment",
      description =
          "Creating one immediately launches the job that fills its course list, so the list is"
              + " there without a second step. At most one recruitment exists per quarter and type.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public Recruitment postRecruitment(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20261") @RequestParam String quarter,
      @Parameter(name = "type") @RequestParam RecruitmentType type,
      @Parameter(name = "tentativeOpeningDate")
          @RequestParam
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate tentativeOpeningDate,
      @Parameter(name = "primaryConsiderationDate")
          @RequestParam
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate primaryConsiderationDate) {

    // Validate before writing; ApiController maps IllegalArgumentException to 400.
    Quarter.yyyyqToInt(quarter);

    if (recruitmentRepository.existsByQuarterAndType(quarter, type)) {
      throw new IllegalArgumentException(
          String.format("A %s recruitment already exists for quarter %s", type, quarter));
    }

    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter(quarter)
                .type(type)
                .applicationStatus(ApplicationStatus.CLOSED)
                .tentativeOpeningDate(tentativeOpeningDate)
                .primaryConsiderationDate(primaryConsiderationDate)
                .build());

    jobService.runAsJob(populateRecruitmentCoursesJobFactory.create(recruitment));
    return recruitment;
  }

  @Operation(summary = "List all recruitments, most recent quarter first")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<Recruitment> allRecruitments() {
    return recruitmentRepository.findAllByOrderByQuarterDescTypeAsc();
  }

  @Operation(
      summary = "Open or close applications for a recruitment",
      description =
          "The first open stamps actualOpeningDate and never overwrites it, so it keeps the date"
              + " applicants were actually able to start. Each close stamps actualClosingDate.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/status")
  public Recruitment updateStatus(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "status") @RequestParam ApplicationStatus status) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    LocalDate today = LocalDate.now();
    if (status == ApplicationStatus.OPEN) {
      if (recruitment.getActualOpeningDate() == null) {
        recruitment.setActualOpeningDate(today);
      }
    } else {
      recruitment.setActualClosingDate(today);
    }
    recruitment.setApplicationStatus(status);

    recruitmentRepository.save(recruitment);
    return recruitment;
  }

  @Operation(
      summary = "Delete a recruitment",
      description = "Its recruitment courses go with it, via the cascading foreign key.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object deleteRecruitment(@Parameter(name = "id") @RequestParam Long id) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    recruitmentRepository.delete(recruitment);
    return genericMessage("Recruitment with id %s deleted".formatted(id));
  }
}
