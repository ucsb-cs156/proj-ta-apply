package edu.ucsb.cs.taapply.startup;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.boot.ApplicationArguments;

class ScaffoldApplicationRunnerTests {

  private ScaffoldApplicationRunner scaffoldApplicationRunner;

  @Mock private ScaffoldStartup scaffoldStartup;
  @Mock private ApplicationArguments mockArgs;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    scaffoldApplicationRunner = new ScaffoldApplicationRunner();
    scaffoldApplicationRunner.scaffoldStartup = scaffoldStartup;
  }

  @Test
  void run_calls_alwaysRunOnStartup() throws Exception {
    scaffoldApplicationRunner.run(mockArgs);
    verify(scaffoldStartup, times(1)).alwaysRunOnStartup();
  }
}
