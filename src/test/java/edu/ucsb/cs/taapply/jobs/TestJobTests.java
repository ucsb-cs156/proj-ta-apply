package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mockStatic;

import edu.ucsb.cs.taapply.utilities.Sleep;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobContext;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

public class TestJobTests {

  @Test
  void test_TestJob_succeeds() throws Exception {
    Job jobStarted = Job.builder().build();
    JobContext ctx = new JobContext(null, jobStarted);

    TestJob job = TestJob.builder().fail(false).sleepMs(42).build();

    try (MockedStatic<Sleep> sleepMock = mockStatic(Sleep.class)) {
      job.accept(ctx);
      sleepMock.verify(() -> Sleep.sleepQuietly(42));
    }

    String expected = """
        Hello World! from test job!
        Goodbye from test job!""";
    assertEquals(expected, jobStarted.getLog());
  }

  @Test
  void test_TestJob_fails() {
    Job jobStarted = Job.builder().build();
    JobContext ctx = new JobContext(null, jobStarted);

    TestJob job = TestJob.builder().fail(true).sleepMs(0).build();

    Exception thrown = assertThrows(Exception.class, () -> job.accept(ctx));
    assertEquals("Fail!", thrown.getMessage());
    assertEquals("Hello World! from test job!", jobStarted.getLog());
  }
}
