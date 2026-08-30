package edu.ucsb.cs.taapply.startup;

import static org.mockito.Mockito.*;

import edu.ucsb.cs.taapply.services.wiremock.WiremockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.boot.ApplicationArguments;

class WiremockApplicationRunnerTests {

  @Mock private WiremockService wiremockService;
  @Mock private ApplicationArguments mockArgs;

  @InjectMocks private WiremockApplicationRunner wiremockApplicationRunner;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
  }

  @Test
  void run_calls_wiremockService_init() throws Exception {
    wiremockApplicationRunner.run(mockArgs);
    verify(wiremockService, times(1)).init();
  }
}
