package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Admin;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin")
@RequestMapping("/api/admin")
@RestController
@Slf4j
public class AdminsController extends ApiController {

  @Autowired AdminRepository adminRepository;
  @Autowired InstructorRepository instructorRepository;
  @Autowired GradStudentRepository gradStudentRepository;
  @Autowired UserRepository userRepository;

  @Value("#{'${app.admin.emails}'.split(',')}")
  List<String> adminEmails;

  public static record AdminDTO(String email, boolean isInAdminEmails) {
    public AdminDTO(Admin admin, List<String> adminEmails) {
      this(admin.getEmail(), adminEmails.contains(admin.getEmail()));
    }
  }

  public static record UserDTO(
      long id,
      String givenName,
      String familyName,
      String email,
      boolean admin,
      boolean instructor,
      boolean gradStudent) {
    public UserDTO(User user, boolean admin, boolean instructor, boolean gradStudent) {
      this(
          user.getId(),
          user.getGivenName(),
          user.getFamilyName(),
          user.getEmail(),
          admin,
          instructor,
          gradStudent);
    }
  }

  public static record UsersPageDTO(
      List<UserDTO> content, int number, int size, long totalElements, int totalPages) {
    public UsersPageDTO(Page<UserDTO> page) {
      this(
          page.getContent(),
          page.getNumber(),
          page.getSize(),
          page.getTotalElements(),
          page.getTotalPages());
    }
  }

  @Operation(summary = "Create a new admin")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public Admin postAdmin(@Parameter(name = "email") @RequestParam String email) {
    String convertedEmail = CanonicalFormConverter.convertToValidEmail(email).strip();
    Admin admin = new Admin(convertedEmail);
    return adminRepository.save(admin);
  }

  @Operation(summary = "List all admins")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public Iterable<AdminDTO> allAdmins() {
    Iterable<Admin> admins = adminRepository.findAll();
    return StreamSupport.stream(admins.spliterator(), false)
        .map(admin -> new AdminDTO(admin, adminEmails))
        .toList();
  }

  @Operation(summary = "List paged users")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/users")
  public UsersPageDTO pagedUsers(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
    Page<UserDTO> userPage =
        userRepository
            .findAll(PageRequest.of(page, size, Sort.by("id")))
            .map(
                user ->
                    new UserDTO(
                        user,
                        adminRepository.existsByEmail(user.getEmail()),
                        instructorRepository.existsByEmail(user.getEmail()),
                        gradStudentRepository.existsByEmail(user.getEmail())));

    return new UsersPageDTO(userPage);
  }

  @Operation(summary = "Delete an Admin")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object deleteAdmin(@Parameter(name = "email") @RequestParam String email) {
    Admin admin =
        adminRepository
            .findByEmail(email)
            .orElseThrow(() -> new EntityNotFoundException(Admin.class, email));
    if (adminEmails.contains(email)) {
      throw new UnsupportedOperationException(
          "Forbidden to delete an admin from ADMIN_EMAILS list");
    }
    adminRepository.delete(admin);
    return genericMessage("Admin with id %s deleted".formatted(email));
  }
}
