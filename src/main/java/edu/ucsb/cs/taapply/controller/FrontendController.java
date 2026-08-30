package edu.ucsb.cs.taapply.controller;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Profile("!development")
@Controller
public class FrontendController {

  /**
   * Forward all non-file, non-API requests to the React app's index.html so that client-side
   * routing works correctly in production.
   */
  @GetMapping("/**/{path:[^\\.]*}")
  public String index() {
    return "forward:/index.html";
  }
}
