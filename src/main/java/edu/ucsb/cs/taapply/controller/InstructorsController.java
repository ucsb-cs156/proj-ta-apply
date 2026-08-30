package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
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

@Tag(name = "Instructors")
@RequestMapping("/api/admin/instructors")
@RestController
@Slf4j
public class InstructorsController extends ApiController {

  @Autowired InstructorRepository instructorRepository;

  @Operation(summary = "Create a new Instructor")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public Instructor postInstructor(@RequestParam String email) {
    String convertedEmail = CanonicalFormConverter.convertToValidEmail(email).strip();
    Instructor instructor = Instructor.builder().email(convertedEmail).build();
    instructorRepository.save(instructor);
    return instructor;
  }

  @Operation(summary = "List all Instructors")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/get")
  public Iterable<Instructor> allInstructors() {
    return instructorRepository.findAll();
  }

  @Operation(summary = "Delete an Instructor by email")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public ResponseEntity<String> deleteInstructor(@RequestParam String email) {
    Instructor instructor = instructorRepository.findById(email).orElse(null);
    if (instructor == null) {
      return ResponseEntity.status(404)
          .body(String.format("Instructor with email %s not found.", email));
    }
    instructorRepository.delete(instructor);
    return ResponseEntity.status(200)
        .body(String.format("Instructor with email %s deleted.", email));
  }
}
