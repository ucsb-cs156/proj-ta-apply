package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.CatalogName;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Instructors")
@RequestMapping("/api/admin/instructors")
@RestController
@Slf4j
public class InstructorsController extends ApiController {

  @Autowired InstructorRepository instructorRepository;
  @Autowired UserRepository userRepository;
  @Autowired CatalogNameRepository catalogNameRepository;

  /**
   * An instructor with their name from the users table, which has a row for them only once they
   * have logged in: until then both names are null. The catalog name is the admin's choice of how
   * the course catalog spells them (issue #120); null until chosen.
   */
  public static record InstructorDTO(
      String email, String givenName, String familyName, String catalogName) {
    public InstructorDTO(Instructor instructor, Optional<User> user) {
      this(
          instructor.getEmail(),
          user.map(User::getGivenName).orElse(null),
          user.map(User::getFamilyName).orElse(null),
          instructor.getCatalogName());
    }
  }

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
  public List<InstructorDTO> allInstructors() {
    Iterable<Instructor> instructors = instructorRepository.findAll();
    return StreamSupport.stream(instructors.spliterator(), false)
        .map(
            instructor ->
                new InstructorDTO(instructor, userRepository.findByEmail(instructor.getEmail())))
        .toList();
  }

  @Operation(
      summary = "Every catalog name on record, alphabetically",
      description =
          "The instructor names the Populate Courses job has seen on primary sections (issue #120),"
              + " for the dropdown on the Instructors page.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/catalogNames")
  public List<String> catalogNames() {
    return catalogNameRepository.findAllByOrderByNameAsc().stream()
        .map(CatalogName::getName)
        .toList();
  }

  @Operation(
      summary = "Set which catalog name an instructor goes by",
      description =
          "A blank catalog name clears the choice. Otherwise it must be one of the names on record;"
              + " 404 for one that is not.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/catalogName")
  public InstructorDTO setCatalogName(
      @Parameter(name = "email") @RequestParam String email,
      @Parameter(name = "catalogName", description = "blank to clear")
          @RequestParam(required = false)
          String catalogName) {
    Instructor instructor =
        instructorRepository
            .findById(email)
            .orElseThrow(() -> new EntityNotFoundException(Instructor.class, email));
    String chosen = catalogName == null || catalogName.isBlank() ? null : catalogName.strip();
    if (chosen != null && !catalogNameRepository.existsById(chosen)) {
      throw new EntityNotFoundException(CatalogName.class, chosen);
    }
    instructor.setCatalogName(chosen);
    instructorRepository.save(instructor);
    return new InstructorDTO(instructor, userRepository.findByEmail(instructor.getEmail()));
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
