package edu.ucsb.cs.taapply;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.config.SecurityConfig;
import edu.ucsb.cs.taapply.interceptors.RoleUpdateInterceptor;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import jakarta.annotation.PostConstruct;
import java.io.UnsupportedEncodingException;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Base class for all controller tests. Provides MockMvc, ObjectMapper, and a no-op
 * RoleUpdateInterceptor so individual tests don't need to mock
 * AdminRepository/InstructorRepository.
 */
@ActiveProfiles("test")
@Import({TestConfig.class, SecurityConfig.class})
public abstract class ControllerTestCase {

  @Autowired public CurrentUserService currentUserService;
  @Autowired public GrantedAuthoritiesService grantedAuthoritiesService;
  @Autowired public MockMvc mockMvc;
  @Autowired public ObjectMapper mapper;

  @MockitoBean RoleUpdateInterceptor roleUpdateInterceptor;

  @PostConstruct
  void passthroughInterceptor() throws Exception {
    when(roleUpdateInterceptor.preHandle(any(), any(), any())).thenReturn(true);
  }

  @SuppressWarnings("unchecked")
  protected Map<String, Object> responseToJson(MvcResult result)
      throws UnsupportedEncodingException, JsonProcessingException {
    return mapper.readValue(result.getResponse().getContentAsString(), Map.class);
  }
}
