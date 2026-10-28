package edu.ucsb.cs.taapply.services;

import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvException;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * The CSV form of an admin-maintained name list (majors, topics): one column, {@code name}.
 *
 * <p>Download and upload use the same shape, so a file downloaded from a QA site can be uploaded
 * unchanged to production. The reader is as forgiving as {@link RoleEmailCsvService}: the header
 * row must contain a {@code name} column (case-insensitive), other columns are ignored, blank rows
 * are skipped, and names are trimmed. There is no such thing as an invalid name, so an upload only
 * reports what was added and what was already there.
 */
@Service
@Slf4j
public class NameListCsvService {

  public static final String NAME_HEADER = "name";

  /** Summary of what an upload did. */
  public static record UploadResult(int inserted, int alreadyPresent) {}

  /** The list as a CSV document: a header row, then one name per row, quoted. */
  public String write(List<String> names) {
    StringWriter out = new StringWriter();
    // Neither flushed nor closed: CSVWriter writes each row straight through to the StringWriter,
    // and close() would only add a checked exception that a StringWriter can never throw.
    CSVWriter writer = new CSVWriter(out);
    writer.writeNext(new String[] {NAME_HEADER});
    for (String name : names) {
      writer.writeNext(new String[] {name});
    }
    return out.toString();
  }

  /**
   * The distinct, trimmed, non-blank names in the file, in file order.
   *
   * @throws ResponseStatusException 400 if the file is empty or has no {@code name} column
   */
  public List<String> read(MultipartFile file) throws IOException, CsvException {
    Set<String> names = new LinkedHashSet<>();

    try (InputStream inputStream = new BufferedInputStream(file.getInputStream());
        InputStreamReader reader = new InputStreamReader(inputStream);
        CSVReader csvReader = new CSVReader(reader)) {

      String[] headers = csvReader.readNext();
      if (headers == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty");
      }
      int nameColumn = nameColumnIndex(headers);

      String[] row;
      while ((row = csvReader.readNext()) != null) {
        if (row.length <= nameColumn) {
          continue;
        }
        String name = row[nameColumn].strip();
        if (!name.isEmpty()) {
          names.add(name);
        }
      }
    }

    log.info("Name list CSV upload: {} distinct names read", names.size());
    return new ArrayList<>(names);
  }

  /** Locates the {@code name} column, tolerating case and surrounding whitespace. */
  static int nameColumnIndex(String[] headers) {
    for (int i = 0; i < headers.length; i++) {
      if (NAME_HEADER.equalsIgnoreCase(headers[i].strip())) {
        return i;
      }
    }
    throw new ResponseStatusException(
        HttpStatus.BAD_REQUEST, "CSV file must have a column named '%s'".formatted(NAME_HEADER));
  }
}
