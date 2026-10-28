package edu.ucsb.cs.taapply;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * pom.xml packages docs/legacy into the jar as public/legacy, so the Admin > Legacy TA Application
 * page can load the one copy of the old form. This proves the packaging and the static-resource
 * mapping, which no unit test of the page can.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LegacyDocsResourceTests {

  @Autowired private MockMvc mockMvc;

  @Test
  void the_legacy_form_is_served_at_legacy() throws Exception {
    mockMvc
        .perform(get("/legacy/legacy-ta-application-form.html"))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("<title>Legacy TA Application Form</title>")))
        .andExpect(content().string(containsString("CS TA/Reader Application Form")));
  }

  /** Only the HTML is packaged; the README stays a GitHub-only document. */
  @Test
  void the_legacy_readme_is_not_served() throws Exception {
    mockMvc.perform(get("/legacy/README.md")).andExpect(status().isNotFound());
  }
}
