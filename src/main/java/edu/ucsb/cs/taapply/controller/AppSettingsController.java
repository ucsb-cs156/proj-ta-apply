package edu.ucsb.cs.taapply.controller;

import com.opencsv.exceptions.CsvException;
import edu.ucsb.cs.taapply.entity.TaMajor;
import edu.ucsb.cs.taapply.entity.TaTopic;
import edu.ucsb.cs.taapply.entity.UlaInterest;
import edu.ucsb.cs.taapply.entity.UlaMajor;
import edu.ucsb.cs.taapply.entity.UlaTopic;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.TaMajorRepository;
import edu.ucsb.cs.taapply.repository.TaTopicRepository;
import edu.ucsb.cs.taapply.repository.UlaInterestRepository;
import edu.ucsb.cs.taapply.repository.UlaMajorRepository;
import edu.ucsb.cs.taapply.repository.UlaTopicRepository;
import edu.ucsb.cs.taapply.services.NameListCsvService;
import edu.ucsb.cs.taapply.services.NameListCsvService.UploadResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.repository.CrudRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * The five admin-maintained name lists behind the TA and ULA application forms: the majors and the
 * topics an applicant may pick from, and for ULAs the interest areas they rate.
 *
 * <p>Each list is its own table with a single string column that is also the key, so the five are
 * served by one controller keyed on the {@code list} path segment rather than five copies of the
 * same CRUD code. Renaming is a delete plus an insert, since the name is the key.
 */
@Tag(name = "AppSettings")
@RequestMapping("/api/admin/settings")
@RestController
@Slf4j
public class AppSettingsController extends ApiController {

  /** A row of any of the lists, as the frontend sees it. */
  public static record NameItem(String name) {}

  /** The repository behind one list, plus how to make one of its rows. */
  record NameList(CrudRepository<?, String> repository, Function<String, Object> row) {

    @SuppressWarnings({"unchecked", "rawtypes"})
    void save(String name) {
      ((CrudRepository) repository).save(row().apply(name));
    }
  }

  public static final String TA_MAJORS = "ta-majors";
  public static final String TA_TOPICS = "ta-topics";
  public static final String ULA_MAJORS = "ula-majors";
  public static final String ULA_TOPICS = "ula-topics";
  public static final String ULA_INTERESTS = "ula-interests";

  @Autowired TaMajorRepository taMajorRepository;
  @Autowired TaTopicRepository taTopicRepository;
  @Autowired UlaMajorRepository ulaMajorRepository;
  @Autowired UlaTopicRepository ulaTopicRepository;
  @Autowired UlaInterestRepository ulaInterestRepository;
  @Autowired NameListCsvService nameListCsvService;

  private final Map<String, NameList> lists = new LinkedHashMap<>();

  @PostConstruct
  void wireLists() {
    lists.put(TA_MAJORS, new NameList(taMajorRepository, n -> TaMajor.builder().name(n).build()));
    lists.put(TA_TOPICS, new NameList(taTopicRepository, n -> TaTopic.builder().name(n).build()));
    lists.put(
        ULA_MAJORS, new NameList(ulaMajorRepository, n -> UlaMajor.builder().name(n).build()));
    lists.put(
        ULA_TOPICS, new NameList(ulaTopicRepository, n -> UlaTopic.builder().name(n).build()));
    lists.put(
        ULA_INTERESTS,
        new NameList(ulaInterestRepository, n -> UlaInterest.builder().name(n).build()));
  }

  private NameList listNamed(String list) {
    NameList found = lists.get(list);
    if (found == null) {
      throw new IllegalArgumentException(
          "No such settings list: %s (expected one of %s)".formatted(list, lists.keySet()));
    }
    return found;
  }

  /**
   * Names are keys, so leading/trailing whitespace would create near-duplicates. The parameter is a
   * required @RequestParam, so it is never null here.
   */
  private static String clean(String name) {
    String cleaned = name.strip();
    if (cleaned.isEmpty()) {
      throw new IllegalArgumentException("A name is required");
    }
    return cleaned;
  }

  private List<NameItem> namesIn(NameList list) {
    return StreamSupport.stream(list.repository().findAll().spliterator(), false)
        .map(row -> new NameItem(nameOf(row)))
        .sorted(Comparator.comparing(NameItem::name, String.CASE_INSENSITIVE_ORDER))
        .toList();
  }

  private static String nameOf(Object row) {
    if (row instanceof TaMajor m) return m.getName();
    if (row instanceof TaTopic t) return t.getName();
    if (row instanceof UlaMajor m) return m.getName();
    if (row instanceof UlaTopic t) return t.getName();
    return ((UlaInterest) row).getName();
  }

  @Operation(
      summary = "Every name in a list, sorted",
      description = "list is one of ta-majors, ta-topics, ula-majors, ula-topics, ula-interests.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/{list}/all")
  public List<NameItem> all(@PathVariable String list) {
    return namesIn(listNamed(list));
  }

  @Operation(summary = "Add a name to a list", description = "400 if it is blank or already there.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/{list}/post")
  public NameItem post(
      @PathVariable String list, @Parameter(name = "name") @RequestParam String name) {
    NameList target = listNamed(list);
    String cleaned = clean(name);
    if (target.repository().existsById(cleaned)) {
      throw new IllegalArgumentException("%s is already in the list".formatted(cleaned));
    }
    target.save(cleaned);
    return new NameItem(cleaned);
  }

  @Operation(
      summary = "Rename an entry",
      description =
          "The name is the key, so this removes the old row and inserts the new one. 404 if the"
              + " old name is not in the list, 400 if the new one already is.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/{list}")
  public NameItem rename(
      @PathVariable String list,
      @Parameter(name = "name") @RequestParam String name,
      @Parameter(name = "newName") @RequestParam String newName) {
    NameList target = listNamed(list);
    String cleanedNew = clean(newName);
    if (!target.repository().existsById(name)) {
      throw new EntityNotFoundException(NameItem.class, name);
    }
    // Renaming to itself is a no-op rather than an error, so saving an unchanged edit is harmless.
    if (!cleanedNew.equals(name)) {
      if (target.repository().existsById(cleanedNew)) {
        throw new IllegalArgumentException("%s is already in the list".formatted(cleanedNew));
      }
      target.repository().deleteById(name);
      target.save(cleanedNew);
    }
    return new NameItem(cleanedNew);
  }

  @Operation(
      summary = "Download a list as CSV",
      description =
          "One column, name, with a header row; the same shape the upload accepts, so a list can be"
              + " moved from one deployment to another.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping(value = "/{list}/csv", produces = "text/csv")
  public ResponseEntity<String> downloadCsv(@PathVariable String list) {
    List<String> names = namesIn(listNamed(list)).stream().map(NameItem::name).toList();
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"%s.csv\"".formatted(list))
        .contentType(new MediaType("text", "csv"))
        .body(nameListCsvService.write(names));
  }

  @Operation(
      summary = "Upload names to a list from a CSV",
      description =
          "The file needs a header row with a column named name; other columns are ignored and"
              + " blank rows are skipped. Names already in the list are counted, not duplicated, so"
              + " re-uploading is safe. 400 if the file is empty or has no name column.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping(
      value = "/{list}/upload/csv",
      consumes = {"multipart/form-data"})
  public UploadResult uploadCsv(
      @PathVariable String list, @Parameter(name = "file") @RequestParam("file") MultipartFile file)
      throws IOException, CsvException {
    NameList target = listNamed(list);
    int inserted = 0;
    int alreadyPresent = 0;
    for (String name : nameListCsvService.read(file)) {
      if (target.repository().existsById(name)) {
        alreadyPresent++;
      } else {
        target.save(name);
        inserted++;
      }
    }
    return new UploadResult(inserted, alreadyPresent);
  }

  @Operation(summary = "Remove a name from a list")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/{list}/delete")
  public Object delete(
      @PathVariable String list, @Parameter(name = "name") @RequestParam String name) {
    NameList target = listNamed(list);
    if (!target.repository().existsById(name)) {
      throw new EntityNotFoundException(NameItem.class, name);
    }
    target.repository().deleteById(name);
    return genericMessage("%s removed from %s".formatted(name, list));
  }
}
