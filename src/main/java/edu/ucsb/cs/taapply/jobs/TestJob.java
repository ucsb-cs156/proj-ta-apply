package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.utilities.Sleep;
import edu.ucsb.cs156.jobs.services.JobContext;
import edu.ucsb.cs156.jobs.services.JobContextConsumer;
import lombok.Builder;

@Builder
public class TestJob implements JobContextConsumer {

  private boolean fail;
  private int sleepMs;

  @Override
  public void accept(JobContext ctx) throws Exception {
    ctx.log("Hello World! from test job!");
    Sleep.sleepQuietly(sleepMs);
    if (fail) {
      throw new Exception("Fail!");
    }
    ctx.log("Goodbye from test job!");
  }
}
