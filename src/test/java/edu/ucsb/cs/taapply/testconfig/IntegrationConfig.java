package edu.ucsb.cs.taapply.testconfig;

import edu.ucsb.cs.taapply.config.SecurityConfig;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;

@TestConfiguration
@Import(SecurityConfig.class)
public class IntegrationConfig {}
