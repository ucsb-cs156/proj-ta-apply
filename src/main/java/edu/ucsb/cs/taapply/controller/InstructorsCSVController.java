package edu.ucsb.cs.taapply.controller;

import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService.UploadResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk upload of instructor email addresses from a CSV file. The parsing and upsert behavior lives
 * in {@link RoleEmailCsvService}, shared with the grad students upload.
 */
@Tag(name = "Instructors")
@RequestMapping("/api/admin/instructors")
@RestController("InstructorsCSVController")
@Slf4j
public class InstructorsCSVController extends ApiController {

  @Autowired private InstructorRepository instructorRepository;
  @Autowired private RoleEmailCsvService roleEmailCsvService;

  @Operation(summary = "Upload a CSV of instructor emails")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping(
      value = "/upload/csv",
      consumes = {"multipart/form-data"})
  public UploadResult uploadInstructorsCSV(
      @Parameter(name = "file") @RequestParam("file") MultipartFile file)
      throws IOException, CsvException {

    return roleEmailCsvService.upload(
        file,
        instructorRepository::existsByEmail,
        email -> instructorRepository.save(Instructor.builder().email(email).build()));
  }
}
