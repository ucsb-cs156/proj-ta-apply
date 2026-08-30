package edu.ucsb.cs.taapply.controller;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.GradStudent;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Bulk upload of grad student email addresses from a CSV file.
 *
 * <p>The file must have a header row containing a column named {@code email} (case-insensitive);
 * any additional columns are ignored. Rows are processed independently: an email that is already
 * present is a no-op rather than an error, and a malformed row is skipped and reported rather than
 * aborting the rows that already succeeded. Re-uploading the same file is therefore safe.
 */
@Tag(name = "GradStudents")
@RequestMapping("/api/admin/gradstudents")
@RestController("GradStudentsCSVController")
@Slf4j
public class GradStudentsCSVController extends ApiController {

  @Autowired private GradStudentRepository gradStudentRepository;

  public static final String EMAIL_HEADER = "email";

  // Deliberately permissive: this is a sanity check against obviously-bad rows, not an attempt to
  // fully validate an address per RFC 5322.
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  /** Summary of what an upload did, so the admin can see which rows did not take effect. */
  public static record UploadResult(
      int inserted, int alreadyPresent, int invalid, List<String> invalidEmails) {}

  @Operation(summary = "Upload a CSV of grad student emails")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping(
      value = "/upload/csv",
      consumes = {"multipart/form-data"})
  public UploadResult uploadGradStudentsCSV(
      @Parameter(name = "file") @RequestParam("file") MultipartFile file)
      throws IOException, CsvException {

    int inserted = 0;
    int alreadyPresent = 0;
    List<String> invalidEmails = new ArrayList<>();

    try (InputStream inputStream = new BufferedInputStream(file.getInputStream());
        InputStreamReader reader = new InputStreamReader(inputStream);
        CSVReader csvReader = new CSVReader(reader)) {

      String[] headers = csvReader.readNext();
      if (headers == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty");
      }

      int emailColumn = emailColumnIndex(headers);

      String[] row;
      while ((row = csvReader.readNext()) != null) {
        if (row.length <= emailColumn) {
          continue;
        }
        String raw = row[emailColumn].trim();
        if (raw.isEmpty()) {
          continue;
        }
        String email = CanonicalFormConverter.convertToValidEmail(raw).strip();
        if (!EMAIL_PATTERN.matcher(email).matches()) {
          invalidEmails.add(raw);
          continue;
        }
        if (gradStudentRepository.existsByEmail(email)) {
          alreadyPresent++;
          continue;
        }
        gradStudentRepository.save(GradStudent.builder().email(email).build());
        inserted++;
      }
    }

    log.info(
        "Grad student CSV upload: inserted={} alreadyPresent={} invalid={}",
        inserted,
        alreadyPresent,
        invalidEmails.size());

    return new UploadResult(inserted, alreadyPresent, invalidEmails.size(), invalidEmails);
  }

  /** Locates the {@code email} column, tolerating case and surrounding whitespace. */
  static int emailColumnIndex(String[] headers) {
    for (int i = 0; i < headers.length; i++) {
      if (EMAIL_HEADER.equalsIgnoreCase(headers[i].trim())) {
        return i;
      }
    }
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST,
        String.format("CSV file must have a column named '%s'", EMAIL_HEADER));
  }
}
