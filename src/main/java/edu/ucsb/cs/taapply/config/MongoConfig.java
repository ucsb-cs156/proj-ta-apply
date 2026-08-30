package edu.ucsb.cs.taapply.config;

import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Production MongoDB configuration. Connects to the real MongoDB instance configured via {@code
 * spring.data.mongodb.uri} (see application-production.properties), which is expected to be set up
 * on Dokku the same way as the Postgres database (see docs/mongodb.md).
 */
@Profile("production")
@Configuration
@EnableMongoRepositories("edu.ucsb.cs.taapply.collections")
@EnableMongoAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class MongoConfig {

  @Bean(name = "auditingDateTimeProvider")
  public DateTimeProvider dateTimeProvider() {
    return () -> Optional.of(OffsetDateTime.now());
  }
}
