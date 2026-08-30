package edu.ucsb.cs.taapply.config;

import de.flapdoodle.embed.mongo.spring.autoconfigure.EmbeddedMongoAutoConfiguration;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Non-production MongoDB configuration, backed by an embedded in-memory MongoDB instance, similar
 * to how H2 is used as an in-memory SQL database for these profiles. Used on localhost and for
 * unit/integration/end-to-end tests, so no external MongoDB instance is required.
 */
@Profile({"development", "integration", "wiremock"})
@Configuration
@EnableAutoConfiguration
@EnableMongoRepositories("edu.ucsb.cs.taapply.collections")
@EnableMongoAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class MongoDevConfig extends EmbeddedMongoAutoConfiguration {

  @Bean(name = "auditingDateTimeProvider")
  public DateTimeProvider dateTimeProvider() {
    return () -> Optional.of(OffsetDateTime.now());
  }
}
