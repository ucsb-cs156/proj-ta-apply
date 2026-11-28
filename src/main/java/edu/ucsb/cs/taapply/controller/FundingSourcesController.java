package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.FundingSource;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.FundingSourceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Comparator;
import java.util.List;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin-maintained list of funding sources (issue #512): the abbreviations the financial office
 * staff put on ULA hiring records, each with an explanation. Admins create, edit and delete them;
 * hiring staff may read the list, since the Funding dropdown on the Soft Offer Results page needs
 * it.
 *
 * <p>The abbreviation is the key, so it is not editable: only the explanation can change. It is
 * stored as typed, after trimming, and compared case-sensitively.
 */
@Tag(name = "Funding Sources")
@RequestMapping("/api/admin/fundingSources")
@RestController
@Slf4j
public class FundingSourcesController extends ApiController {

  /** The longest abbreviation the column holds; the frontend's ABBREVIATION_MAX is the same. */
  public static final int ABBREVIATION_MAX = 10;

  @Autowired FundingSourceRepository fundingSourceRepository;

  /** The body of a PUT: the new explanation. */
  public static record ExplanationBody(String explanation) {}

  /** The abbreviation is a key: trimmed, non-blank, and no longer than the column. */
  static String cleanAbbreviation(String abbreviation) {
    String cleaned = abbreviation.strip();
    if (cleaned.isEmpty()) {
      throw new IllegalArgumentException("An abbreviation is required");
    }
    if (cleaned.length() > ABBREVIATION_MAX) {
      throw new IllegalArgumentException(
          "An abbreviation is at most %d characters (%s has %d)"
              .formatted(ABBREVIATION_MAX, cleaned, cleaned.length()));
    }
    return cleaned;
  }

  /** The explanation is required too; null covers a PUT body without the field. */
  static String cleanExplanation(String explanation) {
    String cleaned = explanation == null ? "" : explanation.strip();
    if (cleaned.isEmpty()) {
      throw new IllegalArgumentException("An explanation is required");
    }
    return cleaned;
  }

  @Operation(
      summary = "List every funding source, sorted by abbreviation",
      description = "Hiring staff may read the list: the Funding dropdown on Soft Offer Results.")
  @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_HIRING_STAFF')")
  @GetMapping("/all")
  public List<FundingSource> allFundingSources() {
    Iterable<FundingSource> all = fundingSourceRepository.findAll();
    return StreamSupport.stream(all.spliterator(), false)
        .sorted(Comparator.comparing(FundingSource::getAbbreviation))
        .toList();
  }

  @Operation(
      summary = "Add a funding source",
      description =
          "Both values are trimmed. 400 if the abbreviation is blank or longer than 10 characters,"
              + " if the explanation is blank, or if the abbreviation already exists.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public FundingSource postFundingSource(
      @Parameter(name = "abbreviation") @RequestParam String abbreviation,
      @Parameter(name = "explanation") @RequestParam String explanation) {
    String cleanedAbbreviation = cleanAbbreviation(abbreviation);
    String cleanedExplanation = cleanExplanation(explanation);
    if (fundingSourceRepository.existsById(cleanedAbbreviation)) {
      throw new IllegalArgumentException(
          "Funding source %s already exists".formatted(cleanedAbbreviation));
    }
    FundingSource fundingSource =
        FundingSource.builder()
            .abbreviation(cleanedAbbreviation)
            .explanation(cleanedExplanation)
            .build();
    return fundingSourceRepository.save(fundingSource);
  }

  @Operation(
      summary = "Change a funding source's explanation",
      description =
          "The abbreviation is the key and cannot change. 404 if there is no such abbreviation, 400"
              + " if the explanation is blank.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/put")
  public FundingSource putFundingSource(
      @Parameter(name = "abbreviation") @RequestParam String abbreviation,
      @RequestBody ExplanationBody body) {
    FundingSource fundingSource =
        fundingSourceRepository
            .findById(abbreviation)
            .orElseThrow(() -> new EntityNotFoundException(FundingSource.class, abbreviation));
    fundingSource.setExplanation(cleanExplanation(body.explanation()));
    return fundingSourceRepository.save(fundingSource);
  }

  @Operation(
      summary = "Delete a funding source",
      description = "404 if there is no such abbreviation.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object deleteFundingSource(
      @Parameter(name = "abbreviation") @RequestParam String abbreviation) {
    FundingSource fundingSource =
        fundingSourceRepository
            .findById(abbreviation)
            .orElseThrow(() -> new EntityNotFoundException(FundingSource.class, abbreviation));
    // Part 2 of issue #512: once the hiring_records table (issue #509) has its funding_source
    // column, refuse here with a 400 that gives the count of hiring records still using this
    // abbreviation, so the staff clear those rows first.
    fundingSourceRepository.delete(fundingSource);
    return genericMessage("FundingSource with id %s deleted".formatted(abbreviation));
  }
}
