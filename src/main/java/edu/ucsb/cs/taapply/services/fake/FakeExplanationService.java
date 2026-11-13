package edu.ucsb.cs.taapply.services.fake;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.utilities.CourseMatching;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Why a fake ULA applicant feels prepared for a course they ask for but have not taken at UCSB
 * (issue #448). The sentences are in {@code data/fake_explanations.json}: a list per course, then
 * one list for any other lower-division course (numbered below 100) and one for any other
 * upper-division course. Courses are looked up ignoring case and spacing ({@link CourseMatching}).
 * When a list has several sentences one is chosen at random, and {@code {course}} in a sentence
 * becomes the course as an applicant would write it, e.g. "CMPSC 156".
 */
@Service
public class FakeExplanationService {

  static final String PATH = "data/fake_explanations.json";

  /** The leading digits of a course number: 5 for "5A", 130 for "130A". */
  private static final Pattern NUMBER = Pattern.compile("^(\\d+)");

  private final Map<String, List<String>> byCourse = new HashMap<>();
  private final List<String> lowerDivision;
  private final List<String> upperDivision;

  public FakeExplanationService() {
    JsonNode data = FakeCoursework.read(new ObjectMapper(), PATH);
    data.get("byCourse")
        .properties()
        .forEach(
            entry ->
                byCourse.put(CourseMatching.squash(entry.getKey()), sentences(entry.getValue())));
    this.lowerDivision = sentences(data.get("lowerDivision"));
    this.upperDivision = sentences(data.get("upperDivision"));
  }

  private static List<String> sentences(JsonNode list) {
    List<String> sentences = new ArrayList<>();
    list.forEach(sentence -> sentences.add(sentence.asText()));
    return sentences;
  }

  /**
   * Whether a course is lower division: its number (the last word of the id, e.g. "5A" in "CMPSC
   * 5A") starts with a number below 100. A course with no number counts as lower division.
   */
  static boolean lowerDivision(String courseId) {
    String[] words = CourseMatching.display(courseId).split(" ");
    Matcher number = NUMBER.matcher(words[words.length - 1]);
    return !number.find() || Integer.parseInt(number.group(1)) < 100;
  }

  /**
   * A fake explanation of why the student is prepared for {@code courseId} (e.g. "CMPSC 156")
   * without having taken it at UCSB.
   */
  public String explanation(String courseId, Random random) {
    List<String> choices =
        byCourse.getOrDefault(
            CourseMatching.squash(courseId),
            lowerDivision(courseId) ? lowerDivision : upperDivision);
    return choices
        .get(random.nextInt(choices.size()))
        .replace("{course}", CourseMatching.display(courseId));
  }
}
