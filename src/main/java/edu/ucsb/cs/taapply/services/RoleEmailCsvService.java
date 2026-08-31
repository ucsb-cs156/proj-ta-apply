package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Bulk upload of email addresses into one of the role tables, from a CSV file.
 *
 * <p>Shared by the grad students and instructors upload endpoints so the two behave identically
 * rather than merely similarly. The caller supplies only what differs: how to tell whether an
 * address is already present, and how to store a new one.
 *
 * <p>The file must have a header row containing a column named {@code email} (case-insensitive);
 * any additional columns are ignored. Rows are processed independently: an address already present
 * is a no-op rather than an error, and a malformed row is skipped and reported rather than aborting
 * the rows that already succeeded. Re-uploading the same file is therefore safe.
 */
@Service
@Slf4j
public class RoleEmailCsvService {

  public static final String EMAIL_HEADER = "email";

  // Deliberately permissive: a sanity check against obviously-bad rows, not an attempt to fully
  // validate an address per RFC 5322.
  private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  /** Summary of what an upload did, so the admin can see which rows did not take effect. */
  public static record UploadResult(
      int inserted, int alreadyPresent, int invalid, List<String> invalidEmails) {}

  /**
   * Reads the file and stores each valid, not-yet-present address.
   *
   * @param exists whether the address is already in the target table
   * @param save stores a new address; called only for valid, absent addresses
   */
  public UploadResult upload(MultipartFile file, Predicate<String> exists, Consumer<String> save)
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
        if (exists.test(email)) {
          alreadyPresent++;
          continue;
        }
        save.accept(email);
        inserted++;
      }
    }

    log.info(
        "Role email CSV upload: inserted={} alreadyPresent={} invalid={}",
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
