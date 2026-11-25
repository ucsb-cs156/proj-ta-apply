package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.HiringStaff;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.HiringStaffRepository;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin's list of who holds the Hiring Staff role (issue #504), kept the way the admins list
 * is: add by email, list with names, delete by email.
 */
@Tag(name = "Hiring Staff")
@RequestMapping("/api/admin/hiringStaff")
@RestController
@Slf4j
public class HiringStaffController extends ApiController {

  @Autowired HiringStaffRepository hiringStaffRepository;
  @Autowired UserRepository userRepository;

  /**
   * A hiring staff member with their name from the users table, which has a row for them only once
   * they have logged in: until then both names are null.
   */
  public static record HiringStaffDTO(String email, String givenName, String familyName) {
    public HiringStaffDTO(HiringStaff hiringStaff, Optional<User> user) {
      this(
          hiringStaff.getEmail(),
          user.map(User::getGivenName).orElse(null),
          user.map(User::getFamilyName).orElse(null));
    }
  }

  @Operation(summary = "Add a hiring staff member by email")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public HiringStaff postHiringStaff(@Parameter(name = "email") @RequestParam String email) {
    String convertedEmail = CanonicalFormConverter.convertToValidEmail(email).strip();
    HiringStaff hiringStaff = HiringStaff.builder().email(convertedEmail).build();
    return hiringStaffRepository.save(hiringStaff);
  }

  @Operation(summary = "List all hiring staff")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<HiringStaffDTO> allHiringStaff() {
    Iterable<HiringStaff> all = hiringStaffRepository.findAll();
    return StreamSupport.stream(all.spliterator(), false)
        .map(h -> new HiringStaffDTO(h, userRepository.findByEmail(h.getEmail())))
        .toList();
  }

  @Operation(summary = "Remove a hiring staff member by email")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object deleteHiringStaff(@Parameter(name = "email") @RequestParam String email) {
    HiringStaff hiringStaff =
        hiringStaffRepository
            .findByEmail(email)
            .orElseThrow(() -> new EntityNotFoundException(HiringStaff.class, email));
    hiringStaffRepository.delete(hiringStaff);
    return genericMessage("HiringStaff with id %s deleted".formatted(email));
  }
}
