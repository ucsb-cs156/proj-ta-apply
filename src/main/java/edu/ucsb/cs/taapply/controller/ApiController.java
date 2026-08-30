package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

@Slf4j
public abstract class ApiController {

  @Autowired private CurrentUserService currentUserService;

  protected CurrentUser getCurrentUser() {
    return currentUserService.getCurrentUser();
  }

  protected Object genericMessage(String message) {
    return Map.of("message", message);
  }

  @ExceptionHandler({EntityNotFoundException.class})
  @ResponseStatus(HttpStatus.NOT_FOUND)
  public Object handleEntityNotFoundException(Throwable e) {
    return Map.of(
        "type", e.getClass().getSimpleName(),
        "message", e.getMessage());
  }

  @ExceptionHandler({ForbiddenException.class})
  @ResponseStatus(HttpStatus.FORBIDDEN)
  public Object handleForbiddenException(Throwable e) {
    return Map.of(
        "type", e.getClass().getSimpleName(),
        "message", e.getMessage());
  }

  @ExceptionHandler(UnsupportedOperationException.class)
  public ResponseEntity<Map<String, String>> handleUnsupportedOperation(
      UnsupportedOperationException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", ex.getMessage()));
  }

  /**
   * This method handles the IllegalArgumentException. This maps to a 400/Bad Request.
   *
   * @param e the exception
   * @return a map with the type and message of the exception
   */
  @ExceptionHandler({IllegalArgumentException.class})
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public Object handleIllegalArgument(Throwable e) {
    return Map.of(
        "type", e.getClass().getSimpleName(),
        "message", e.getMessage());
  }
}
