package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Exercises the exception handlers in ApiController that DummyController's other endpoints and
 * RoleUpdateInterceptorTests don't reach.
 */
@WebMvcTest(controllers = DummyController.class)
public class ApiControllerTests extends ControllerTestCase {

  @Test
  public void forbidden_exception_returns_403_with_type_and_message() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/dummycontroller/forbidden"))
            .andExpect(status().isForbidden())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("ForbiddenException", json.get("type"));
    assertEquals("Forbidden!", json.get("message"));
  }

  @Test
  public void illegal_argument_exception_returns_400_with_type_and_message() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/dummycontroller/illegalArgument"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("IllegalArgumentException", json.get("type"));
    assertEquals("Bad argument!", json.get("message"));
  }
}
