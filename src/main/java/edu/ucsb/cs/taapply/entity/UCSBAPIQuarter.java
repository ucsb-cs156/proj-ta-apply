package edu.ucsb.cs.taapply.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One quarter of the UCSB quarter calendar, exactly as the UCSB API describes it (issue #151): its
 * names and the dates of its classes, finals, registration passes and deadlines. The same shape as
 * proj-courses' {@code UCSBAPIQuarter}, so a row can be read straight from the API's JSON. A later
 * feature will offer these dates as fields in the notices text, e.g. {@code ${firstDayOfQuarter}}
 * for the recruitment's quarter.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Entity(name = "ucsbapiquarter")
public class UCSBAPIQuarter {
  @Id private String quarter; // example: 20243
  private String qyy; // example: M24
  private String name; // example: SUMMER 2024
  private String category; // example: SUMMER
  private String academicYear; // example: 2023-2024
  private LocalDateTime firstDayOfClasses; // example: 2024-06-24T00:00:00
  private LocalDateTime lastDayOfClasses; // example: 2024-09-13T00:00:00
  private LocalDateTime firstDayOfFinals; // example: 2024-09-14T00:00:00
  private LocalDateTime lastDayOfFinals; // example: 2024-09-14T00:00:00
  private LocalDateTime firstDayOfQuarter; // example: 2024-06-24T00:00:00
  private LocalDateTime lastDayOfSchedule; // example: 2024-09-21T00:00:00
  private LocalDateTime pass1Begin; // example: 2024-04-08T09:00:00
  private LocalDateTime pass2Begin; // example: 2024-04-22T09:00:00
  private LocalDateTime pass3Begin; // example: 2024-05-06T09:00:00
  private LocalDateTime feeDeadline; // example: 2024-06-26T00:00:00
  private LocalDateTime lastDayToAddUnderGrad; // example: 2024-07-15T00:00:00
  private LocalDateTime lastDayToAddGrad; // example: 2024-09-13T00:00:00
  private LocalDateTime lastDayThirdWeek; // example: null
}
