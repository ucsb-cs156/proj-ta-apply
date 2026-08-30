package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.GradStudent;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "GradStudents")
@RequestMapping("/api/admin/gradstudents")
@RestController
@Slf4j
public class GradStudentsController extends ApiController {

  @Autowired GradStudentRepository gradStudentRepository;

  @Operation(summary = "Create a new Grad Student")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public GradStudent postGradStudent(@RequestParam String email) {
    String convertedEmail = CanonicalFormConverter.convertToValidEmail(email).strip();
    GradStudent gradStudent = GradStudent.builder().email(convertedEmail).build();
    gradStudentRepository.save(gradStudent);
    return gradStudent;
  }

  @Operation(summary = "List all Grad Students")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/get")
  public Iterable<GradStudent> allGradStudents() {
    return gradStudentRepository.findAll();
  }

  @Operation(summary = "Delete a Grad Student by email")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public ResponseEntity<String> deleteGradStudent(@RequestParam String email) {
    GradStudent gradStudent = gradStudentRepository.findById(email).orElse(null);
    if (gradStudent == null) {
      return ResponseEntity.status(404)
          .body(String.format("Grad Student with email %s not found.", email));
    }
    gradStudentRepository.delete(gradStudent);
    return ResponseEntity.status(200)
        .body(String.format("Grad Student with email %s deleted.", email));
  }
}
