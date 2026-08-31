package edu.ucsb.cs.taapply.controller;

import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.GradStudent;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
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
 * Bulk upload of grad student email addresses from a CSV file. The parsing and upsert behavior
 * lives in {@link RoleEmailCsvService}, shared with the instructors upload.
 */
@Tag(name = "GradStudents")
@RequestMapping("/api/admin/gradstudents")
@RestController("GradStudentsCSVController")
@Slf4j
public class GradStudentsCSVController extends ApiController {

  @Autowired private GradStudentRepository gradStudentRepository;
  @Autowired private RoleEmailCsvService roleEmailCsvService;

  @Operation(summary = "Upload a CSV of grad student emails")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping(
      value = "/upload/csv",
      consumes = {"multipart/form-data"})
  public UploadResult uploadGradStudentsCSV(
      @Parameter(name = "file") @RequestParam("file") MultipartFile file)
      throws IOException, CsvException {

    return roleEmailCsvService.upload(
        file,
        gradStudentRepository::existsByEmail,
        email -> gradStudentRepository.save(GradStudent.builder().email(email).build()));
  }
}
