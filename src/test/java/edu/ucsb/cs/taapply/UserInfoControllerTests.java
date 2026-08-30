package edu.ucsb.cs.taapply;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class UserInfoControllerTests {

  @Autowired private MockMvc mockMvc;

  @Test
  @WithMockUser(roles = "USER")
  void getCurrentUserWhenAuthenticatedReturns200() throws Exception {
    mockMvc
        .perform(get("/api/currentUser"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.roles").isArray());
  }
}
