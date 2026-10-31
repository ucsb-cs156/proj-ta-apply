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
import java.util.function.BiConsumer;
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
 * <p>Written for the instructors upload endpoint, and once shared with the grad students one, so
 * any later role table behaves identically rather than merely similarly. The caller supplies only
 * what differs: how to tell whether an address is already present, and how to store a new one.
 *
 * <p>The file must have a header row containing a column named {@code email} (case-insensitive);
 * any additional columns are ignored, except one the caller may name as carrying an extra value for
 * each row (the instructors upload uses {@code catalogName}, issue #172). Rows are processed
 * independently: an address already present is a no-op rather than an error, and a malformed row is
 * skipped and reported rather than aborting the rows that already succeeded. Re-uploading the same
 * file is therefore safe.
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
   * Reads the file and stores each valid, not-yet-present address, passing along the row's value of
   * one optional column (issue #172).
   *
   * @param optionalColumn header name of a column whose value accompanies each address; matched
   *     like {@code email} (case-insensitive, whitespace-tolerant), null when the file lacks the
   *     column or the cell is blank
   * @param exists whether the address is already in the target table
   * @param save stores a new address and its optional value; called only for valid, absent
   *     addresses
   * @param updateExisting called instead of {@code save} for a valid address already present (still
   *     counted as already present), so the optional value can be applied to it
   */
  public UploadResult upload(
      MultipartFile file,
      String optionalColumn,
      Predicate<String> exists,
      BiConsumer<String, String> save,
      BiConsumer<String, String> updateExisting)
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
      int extraColumn = columnIndex(headers, optionalColumn);

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
        String extra = extraColumn < 0 || row.length <= extraColumn ? "" : row[extraColumn].trim();
        String extraValue = extra.isEmpty() ? null : extra;
        if (exists.test(email)) {
          alreadyPresent++;
          updateExisting.accept(email, extraValue);
          continue;
        }
        save.accept(email, extraValue);
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
    int index = columnIndex(headers, EMAIL_HEADER);
    if (index < 0) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          String.format("CSV file must have a column named '%s'", EMAIL_HEADER));
    }
    return index;
  }

  /** The named column's index, tolerating case and surrounding whitespace; -1 when absent. */
  static int columnIndex(String[] headers, String name) {
    for (int i = 0; i < headers.length; i++) {
      if (name.equalsIgnoreCase(headers[i].trim())) {
        return i;
      }
    }
    return -1;
  }
}
