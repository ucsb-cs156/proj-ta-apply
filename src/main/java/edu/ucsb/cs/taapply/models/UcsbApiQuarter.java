package edu.ucsb.cs.taapply.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The one field we need from the UCSB quarter calendar API's "current quarter" endpoint. That
 * response also carries names, categories and a dozen calendar dates; all are ignored here, since
 * this app only needs to know which quarter it is.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UcsbApiQuarter {
  private String quarter; // YYYYQ, e.g. "20243"
}
