package edu.ucsb.cs.taapply.startup;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class ScaffoldApplicationRunner implements ApplicationRunner {

  @Autowired ScaffoldStartup scaffoldStartup;

  @Override
  public void run(ApplicationArguments args) throws Exception {
    log.info("ScaffoldApplicationRunner.run called");
    scaffoldStartup.alwaysRunOnStartup();
  }
}
