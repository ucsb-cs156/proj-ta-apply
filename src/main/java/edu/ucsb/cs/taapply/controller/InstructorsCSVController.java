package edu.ucsb.cs.taapply.controller;

import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.CatalogNameRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService;
import edu.ucsb.cs.taapply.services.RoleEmailCsvService.UploadResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.io.StringWriter;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bulk upload and download of the instructor list as a CSV file (issue #172). The parsing and
 * upsert behavior lives in {@link RoleEmailCsvService}, shared with the grad students upload.
 */
@Tag(name = "Instructors")
@RequestMapping("/api/admin/instructors")
@RestController("InstructorsCSVController")
@Slf4j
public class InstructorsCSVController extends ApiController {

  /** The optional upload column and download header carrying the instructor's catalog name. */
  public static final String CATALOG_NAME_HEADER = "catalogName";

  @Autowired private InstructorRepository instructorRepository;
  @Autowired private UserRepository userRepository;
  @Autowired private CatalogNameRepository catalogNameRepository;
  @Autowired private RoleEmailCsvService roleEmailCsvService;

  @Operation(
      summary = "Upload a CSV of instructors",
      description =
          "The file needs a header row with a column named email; a file of just emails is enough."
              + " A catalogName column, when present, sets each instructor's catalog name (new or"
              + " already on the list) when the value is a name on record; other columns, such as"
              + " the downloaded firstName and lastName, are ignored (names come from the users"
              + " table when the instructor logs in).")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping(
      value = "/upload/csv",
      consumes = {"multipart/form-data"})
  public UploadResult uploadInstructorsCSV(
      @Parameter(name = "file") @RequestParam("file") MultipartFile file)
      throws IOException, CsvException {

    return roleEmailCsvService.upload(
        file,
        CATALOG_NAME_HEADER,
        instructorRepository::existsByEmail,
        (email, catalogName) ->
            instructorRepository.save(
                Instructor.builder()
                    .email(email)
                    .catalogName(knownCatalogName(catalogName))
                    .build()),
        (email, catalogName) -> {
          String known = knownCatalogName(catalogName);
          if (known != null) {
            instructorRepository
                .findById(email)
                .ifPresent(
                    instructor -> {
                      instructor.setCatalogName(known);
                      instructorRepository.save(instructor);
                    });
          }
        });
  }

  /**
   * The catalog name when it is one on record, otherwise null: the instructors table's foreign key
   * allows only known names, so an unrecognized one is left unset rather than failing the row.
   */
  private String knownCatalogName(String catalogName) {
    return catalogName != null && catalogNameRepository.existsById(catalogName)
        ? catalogName
        : null;
  }

  @Operation(
      summary = "Download the instructors as CSV",
      description =
          "Columns email, firstName, lastName and catalogName, with a header row and every cell"
              + " quoted. The upload accepts this shape, so the list can be moved from one"
              + " deployment to another; names are blank for instructors who have not logged in.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(value = "/download/csv", produces = "text/csv")
  public ResponseEntity<String> downloadInstructorsCSV() {
    StringWriter out = new StringWriter();
    // Neither flushed nor closed: CSVWriter writes each row straight through to the StringWriter,
    // and close() would only add a checked exception that a StringWriter can never throw.
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(
        new String[] {
          RoleEmailCsvService.EMAIL_HEADER, "firstName", "lastName", CATALOG_NAME_HEADER
        });
    for (Instructor instructor : instructorRepository.findAll()) {
      Optional<User> user = userRepository.findByEmail(instructor.getEmail());
      writer.writeNext(
          new String[] {
            instructor.getEmail(),
            user.map(User::getGivenName).orElse(""),
            user.map(User::getFamilyName).orElse(""),
            instructor.getCatalogName() == null ? "" : instructor.getCatalogName()
          });
    }
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"instructors.csv\"")
        .contentType(new MediaType("text", "csv"))
        .body(out.toString());
  }
}
