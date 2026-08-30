package edu.ucsb.cs.taapply.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The only two fields we take from the UCSB curriculum API's class search: the course number and
 * its title. Everything else in the response (sections, GEs, units, ...) is deliberately ignored,
 * since iteration 2 stores catalog entries rather than offerings.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UcsbCourse {
  private String courseId;
  private String title;
}
