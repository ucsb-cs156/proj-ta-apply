package edu.ucsb.cs.taapply.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One section of a course offering. Narrowed to what a recruitment needs; the API returns a good
 * deal more (grading options, restrictions, concurrent courses) that is deliberately ignored.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UcsbSection {
  private String enrollCode;
  private String section;
  private String session;
  private String classClosed;
  private String courseCancelled;
  private Integer enrolledTotal;
  private Integer maxEnroll;
  private List<UcsbTimeLocation> timeLocations;
  private List<UcsbInstructor> instructors;

  /**
   * A primary section is a lecture; its number ends in "00". Secondaries (discussions, labs) are
   * not recruited for separately, so only primaries become recruitment course rows.
   */
  @JsonIgnore
  public boolean isPrimary() {
    return section != null && section.matches("\\d+00");
  }
}
