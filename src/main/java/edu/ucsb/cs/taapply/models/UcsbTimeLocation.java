package edu.ucsb.cs.taapply.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** When and where a section meets. Only the first one of a primary section is used. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UcsbTimeLocation {
  private String days;
  private String beginTime;
  private String endTime;
  private String building;
  private String room;
}
