package edu.ucsb.cs.taapply;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.time.Duration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

// Embedded Mongo auto-configuration is only wired up explicitly via MongoDevConfig
// (for localhost/testing/integration profiles); exclude it here so it doesn't
// try to start on every profile, including production.
@SpringBootApplication(
    excludeName = {"de.flapdoodle.embed.mongo.spring.autoconfigure.EmbeddedMongoAutoConfiguration"})
public class TaApplyApplication {

  /*
   * A RestTemplate built with no timeout blocks its calling thread forever on a hung external
   * call. That's a real incident lib-jobs' single-threaded jobsExecutor hit on another app
   * (proj-scaffold): a job stuck this way permanently wedged the executor, with no way to recover
   * short of restarting the app (see lib-jobs DESIGN.md 9 -- cooperative job cancellation only
   * helps a job that reaches another checkpoint, which a truly hung thread never will). Generous
   * but finite: long enough to never trip on legitimate slowness, short enough to guarantee a job
   * can't hang forever. Built via SimpleClientHttpRequestFactory directly rather than an injected
   * RestTemplateBuilder: RestTemplateAutoConfiguration (which supplies that bean) isn't loaded in
   * every @WebMvcTest slice that loads this class as its configuration, and beans declared here
   * must resolve in all of them.
   */
  private static final int CONNECT_TIMEOUT_MILLIS = (int) Duration.ofSeconds(10).toMillis();
  private static final int READ_TIMEOUT_MILLIS = (int) Duration.ofSeconds(60).toMillis();

  public static void main(String[] args) {
    SpringApplication.run(TaApplyApplication.class, args);
  }

  @Bean
  @Primary
  public RestTemplate restTemplate() {
    SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
    requestFactory.setReadTimeout(READ_TIMEOUT_MILLIS);
    return new RestTemplate(requestFactory);
  }

  /**
   * A second {@link RestTemplate}, used only by {@code CheckLinksService}'s DOI content negotiation
   * lookups: unlike the default {@link #restTemplate}, it never follows redirects, so a DOI that
   * {@code doi.org} would otherwise 302 onward to a (possibly WAF-protected) publisher page is left
   * unfollowed instead of risking a bot-triggered 403 from that publisher.
   */
  @Bean
  public RestTemplate noRedirectRestTemplate() {
    SimpleClientHttpRequestFactory requestFactory =
        new SimpleClientHttpRequestFactory() {
          @Override
          protected void prepareConnection(HttpURLConnection connection, String httpMethod)
              throws IOException {
            super.prepareConnection(connection, httpMethod);
            connection.setInstanceFollowRedirects(false);
          }
        };
    requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
    requestFactory.setReadTimeout(READ_TIMEOUT_MILLIS);
    return new RestTemplate(requestFactory);
  }
}
