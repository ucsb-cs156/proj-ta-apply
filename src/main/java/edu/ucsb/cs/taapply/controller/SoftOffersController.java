package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.models.SoftOfferDto;
import edu.ucsb.cs.taapply.services.SoftOffersService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * An applicant's soft offers (issue #486): the open ones, and answering one. Everything here is
 * about the signed-in user's own applications.
 */
@Tag(name = "Soft Offers")
@RequestMapping("/api/softOffers")
@RestController
@Slf4j
public class SoftOffersController extends ApiController {

  @Autowired SoftOffersService softOffersService;

  /** The body of an answer: the optional comments. */
  public static record Answer(String comments) {}

  @Operation(
      summary = "The current user's open soft offers",
      description =
          "One per released ULA recruitment in which the user's live application is assigned to a"
              + " lecture: the lecture, its sections (null if the UCSB API could not be reached),"
              + " the notice text, the deadline and the answer so far. Empty when there is none.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/mine")
  public List<SoftOfferDto> mine() {
    return softOffersService.mine(currentEmail());
  }

  @Operation(
      summary = "Answer one of the current user's soft offers",
      description =
          "Records PROCEED or DECLINE with the comments, once per (application, lecture). 404 for an"
              + " unknown application, 403 for someone else's, 400 when no soft offer is open for it"
              + " or the comments exceed 4000 characters, 409 when it has been answered already.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/respond")
  public ResponseEntity<Object> respond(
      @Parameter(name = "applicationId") @RequestParam Long applicationId,
      @Parameter(name = "decision") @RequestParam SoftOfferDecision decision,
      @RequestBody(required = false) Answer answer) {
    try {
      return ResponseEntity.ok(
          softOffersService.respond(
              currentEmail(), applicationId, decision, answer == null ? null : answer.comments()));
    } catch (IllegalStateException e) {
      return ResponseEntity.status(HttpStatus.CONFLICT)
          .body(Map.of("type", "IllegalStateException", "message", e.getMessage()));
    }
  }

  private String currentEmail() {
    return getCurrentUser().getUser().getEmail();
  }
}
