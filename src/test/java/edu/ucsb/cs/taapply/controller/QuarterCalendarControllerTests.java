package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = QuarterCalendarController.class)
@Import(TestConfig.class)
public class QuarterCalendarControllerTests extends ControllerTestCase {

  @MockitoBean UCSBAPIQuarterRepository repository;
  @MockitoBean UserRepository userRepository;

  private static final UCSBAPIQuarter F21 =
      UCSBAPIQuarter.builder()
          .quarter("20214")
          .qyy("F21")
          .name("FALL 2021")
          .category("FALL")
          .academicYear("2021-2022")
          .firstDayOfClasses(LocalDateTime.of(2021, 10, 1, 0, 0))
          .pass1Begin(LocalDateTime.of(2021, 5, 10, 9, 0))
          .build();

  @Test
  public void logged_out_users_cannot_read_a_quarter() throws Exception {
    mockMvc.perform(get("/api/quarters/one?yyyyq=20214")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void any_signed_in_user_gets_the_quarter_on_file() throws Exception {
    when(repository.findById("20214")).thenReturn(Optional.of(F21));

    MvcResult response =
        mockMvc
            .perform(get("/api/quarters/one?yyyyq=20214"))
            .andExpect(status().isOk())
            .andReturn();

    verify(repository, times(1)).findById("20214");
    assertEquals(mapper.writeValueAsString(F21), response.getResponse().getContentAsString());
    Map<String, Object> json = responseToJson(response);
    assertEquals("F21", json.get("qyy"));
    assertEquals("2021-10-01T00:00:00", json.get("firstDayOfClasses"));
    assertEquals("2021-05-10T09:00:00", json.get("pass1Begin"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_quarter_not_on_file_is_a_404() throws Exception {
    when(repository.findById("20301")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/quarters/one?yyyyq=20301"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("UCSBAPIQuarter with id 20301 not found", json.get("message"));
  }
}
