package edu.ucsb.cs.taapply.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Guards the split of the {@code *WebIT} classes into parallel CI shards (issue #328).
 *
 * <p>{@code .github/workflows/41-integration.yml} runs one job per shard listed in {@code
 * src/test/resources/it-shards.json} and passes that shard's classes to failsafe with {@code
 * -Dit.test}. A {@code *WebIT} class missing from the file would therefore never run in CI, so this
 * ordinary unit test (it runs in the normal build, not as an integration test) fails when a class
 * is in no shard, in two shards, or listed but does not exist. See
 * docs/testing/integration-shards.md.
 */
class ItShardAssignmentTests {

  private static final String SUFFIX = "WebIT";

  /** Every {@code *WebIT} class found in the test source tree. */
  private static Set<String> existingWebItClasses() throws IOException {
    Path root = Path.of("src", "test", "java");
    assertFalse(!Files.isDirectory(root), "run the tests from the project root");
    try (Stream<Path> files = Files.walk(root)) {
      Set<String> names = new TreeSet<>();
      files
          .map(p -> p.getFileName().toString())
          .filter(n -> n.endsWith(SUFFIX + ".java"))
          .forEach(n -> names.add(n.substring(0, n.length() - ".java".length())));
      return names;
    }
  }

  private static Map<String, List<String>> readShards() throws IOException {
    try (InputStream in = ItShardAssignmentTests.class.getResourceAsStream("/it-shards.json")) {
      assertNotNull(in, "src/test/resources/it-shards.json is missing");
      return new ObjectMapper()
          .readValue(in, new TypeReference<TreeMap<String, List<String>>>() {});
    }
  }

  /** Describes every way the assignment disagrees with the classes that exist; empty when sound. */
  static List<String> problems(Set<String> existing, Map<String, List<String>> shards) {
    List<String> problems = new ArrayList<>();
    Map<String, String> owner = new TreeMap<>();
    shards.forEach(
        (shard, classes) -> {
          if (classes.isEmpty()) {
            problems.add("shard " + shard + " has no classes, so its CI job would run nothing");
          }
          for (String c : classes) {
            if (!existing.contains(c)) {
              problems.add("shard " + shard + " lists " + c + ", which is not a *WebIT class");
            }
            String previous = owner.put(c, shard);
            if (previous != null) {
              problems.add(c + " is in shard " + previous + " and in shard " + shard);
            }
          }
        });
    for (String c : existing) {
      if (!owner.containsKey(c)) {
        problems.add(
            c
                + " is in no shard, so CI would never run it: add it to"
                + " src/test/resources/it-shards.json");
      }
    }
    return problems;
  }

  @Test
  void every_web_it_class_is_in_exactly_one_shard() throws IOException {
    Set<String> existing = existingWebItClasses();
    assertFalse(
        existing.isEmpty(), "found no *WebIT classes; is the scan looking in the right place?");
    assertEquals(List.of(), problems(existing, readShards()));
  }

  @Test
  void reports_a_class_that_is_in_no_shard() {
    List<String> p = problems(Set.of("AWebIT", "BWebIT"), Map.of("1", List.of("AWebIT")));
    assertEquals(
        List.of(
            "BWebIT is in no shard, so CI would never run it: add it to"
                + " src/test/resources/it-shards.json"),
        p);
  }

  @Test
  void reports_a_listed_class_that_does_not_exist() {
    List<String> p = problems(Set.of("AWebIT"), Map.of("1", List.of("AWebIT", "GoneWebIT")));
    assertEquals(List.of("shard 1 lists GoneWebIT, which is not a *WebIT class"), p);
  }

  @Test
  void reports_a_class_in_two_shards() {
    Map<String, List<String>> shards = new TreeMap<>();
    shards.put("1", List.of("AWebIT"));
    shards.put("2", List.of("AWebIT"));
    assertEquals(
        List.of("AWebIT is in shard 1 and in shard 2"), problems(Set.of("AWebIT"), shards));
  }

  @Test
  void reports_an_empty_shard() {
    Map<String, List<String>> shards = new TreeMap<>();
    shards.put("1", List.of("AWebIT"));
    shards.put("2", List.of());
    assertEquals(
        List.of("shard 2 has no classes, so its CI job would run nothing"),
        problems(Set.of("AWebIT"), shards));
  }

  @Test
  void accepts_a_sound_assignment() {
    Map<String, List<String>> shards = new TreeMap<>();
    shards.put("1", List.of("AWebIT"));
    shards.put("2", List.of("BWebIT"));
    assertEquals(List.of(), problems(Set.of("AWebIT", "BWebIT"), shards));
  }
}
