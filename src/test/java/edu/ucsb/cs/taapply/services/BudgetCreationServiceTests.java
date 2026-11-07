package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Issue #384: a new quarter's budget starts as a copy of the most recent earlier quarter's. */
@SpringBootTest(classes = {BudgetCreationService.class})
@ActiveProfiles("test")
public class BudgetCreationServiceTests {

  @Autowired BudgetCreationService service;
  @MockitoBean BudgetRepository budgetRepository;

  private static final String Q = "20271";

  /** The spring 2026 budget, every figure entered and both counters moved. */
  private static Budget previous() {
    return Budget.builder()
        .quarter("20264")
        .unrestrictedBudget(new BigDecimal("699315.00"))
        .tasOnlyBudget(new BigDecimal("12.50"))
        .ulasOnlyBudget(new BigDecimal("166667.00"))
        .taCostPerQuarter(new BigDecimal("13110.00"))
        .ulaRateDollarsPerHour(new BigDecimal("29.38"))
        .estimatedHoursPerULAPerQuarter(new BigDecimal("110.00"))
        .giftFundsForASEs(new BigDecimal("32200.00"))
        .conversionTAtoULA(2.5)
        .version(7)
        .conversionVersion(3)
        .build();
  }

  @BeforeEach
  public void nothingOnFile() {
    when(budgetRepository.findById(any())).thenReturn(Optional.empty());
    when(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc(any()))
        .thenReturn(Optional.empty());
    when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
  }

  @Test
  public void a_budget_on_file_is_returned_as_it_is_and_nothing_is_written() {
    Budget onFile = Budget.builder().quarter(Q).unrestrictedBudget(new BigDecimal("5")).build();
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(onFile));

    assertSame(onFile, service.findOrCreate(Q));

    verify(budgetRepository, never()).save(any());
    verify(budgetRepository, never()).findFirstByQuarterLessThanOrderByQuarterDesc(any());
  }

  @Test
  public void with_no_earlier_budget_the_new_one_has_the_defaults_and_is_saved() {
    Budget created = service.findOrCreate(Q);

    assertEquals(Q, created.getQuarter());
    assertEquals(BigDecimal.ZERO, created.getUnrestrictedBudget());
    assertEquals(BigDecimal.ZERO, created.getTasOnlyBudget());
    assertEquals(BigDecimal.ZERO, created.getUlasOnlyBudget());
    assertNull(created.getTaCostPerQuarter());
    assertNull(created.getUlaRateDollarsPerHour());
    assertNull(created.getEstimatedHoursPerULAPerQuarter());
    assertNull(created.getGiftFundsForASEs());
    assertEquals(Budget.DEFAULT_CONVERSION_TA_TO_ULA, created.getConversionTAtoULA());
    assertEquals(0, created.getVersion());
    assertEquals(0, created.getConversionVersion());
    verify(budgetRepository).save(created);
    verify(budgetRepository).findFirstByQuarterLessThanOrderByQuarterDesc(Q);
  }

  @Test
  public void the_new_budget_copies_every_planning_figure_of_the_most_recent_earlier_one() {
    when(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc(Q))
        .thenReturn(Optional.of(previous()));

    Budget created = service.findOrCreate(Q);

    assertEquals(Q, created.getQuarter());
    assertEquals(new BigDecimal("699315.00"), created.getUnrestrictedBudget());
    assertEquals(new BigDecimal("12.50"), created.getTasOnlyBudget());
    assertEquals(new BigDecimal("166667.00"), created.getUlasOnlyBudget());
    assertEquals(new BigDecimal("13110.00"), created.getTaCostPerQuarter());
    assertEquals(new BigDecimal("29.38"), created.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("110.00"), created.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("32200.00"), created.getGiftFundsForASEs());
    assertEquals(2.5, created.getConversionTAtoULA());
    // The counters are the new row's own, not copied.
    assertEquals(0, created.getVersion());
    assertEquals(0, created.getConversionVersion());
    verify(budgetRepository).save(created);
  }

  @Test
  public void figures_the_earlier_budget_never_had_stay_empty_in_the_copy() {
    Budget sparse = Budget.builder().quarter("20262").ulasOnlyBudget(new BigDecimal("1")).build();
    when(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc(Q))
        .thenReturn(Optional.of(sparse));

    Budget created = service.findOrCreate(Q);

    assertEquals(new BigDecimal("1"), created.getUlasOnlyBudget());
    assertEquals(BigDecimal.ZERO, created.getUnrestrictedBudget());
    assertNull(created.getTaCostPerQuarter());
    assertNull(created.getGiftFundsForASEs());
    assertEquals(Budget.DEFAULT_CONVERSION_TA_TO_ULA, created.getConversionTAtoULA());
  }

  @Test
  public void startingBudget_builds_the_copy_without_saving_it() {
    when(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc(Q))
        .thenReturn(Optional.of(previous()));

    Budget starting = service.startingBudget(Q);

    assertEquals(Q, starting.getQuarter());
    assertEquals(new BigDecimal("13110.00"), starting.getTaCostPerQuarter());
    verify(budgetRepository, never()).save(any());
  }
}
