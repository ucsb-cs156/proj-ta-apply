package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Used to test ApiController exception handlers and RoleUpdateInterceptor. */
@RequestMapping("/dummycontroller")
@RestController
public class DummyController extends ApiController {

  @GetMapping("")
  public String getById(@RequestParam Long id) {
    if (id == 1) return "String1";
    throw new EntityNotFoundException(String.class, id);
  }

  @GetMapping("/interceptorTest")
  public ResponseEntity<String> interceptorTest() {
    return ResponseEntity.ok("OK");
  }

  @GetMapping("/forbidden")
  public String forbidden() {
    throw new ForbiddenException("Forbidden!");
  }

  @GetMapping("/illegalArgument")
  public String illegalArgument() {
    throw new IllegalArgumentException("Bad argument!");
  }
}
