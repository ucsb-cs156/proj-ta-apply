package edu.ucsb.cs.taapply;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class TaApplyApplicationTests {

  @Autowired private MockMvc mockMvc;

  @Test
  void healthCheckReturnsOk() throws Exception {
    mockMvc
        .perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ok"));
  }

  @Test
  void getSystemInfoReturnsOk() throws Exception {
    mockMvc
        .perform(get("/api/systemInfo"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.oauthLogin").exists());
  }

  // Spring's own SimpleClientHttpRequestFactory#prepareConnection already sets
  // setInstanceFollowRedirects(false) for every non-GET method, so a POST request can't tell
  // apart "our explicit override ran" from "Spring's own default happened to agree with it" —
  // hence two tests, each isolating one side effect: this one uses POST (whose request method
  // Spring's super call sets, but whose default HttpURLConnection followRedirects is already
  // irrelevant) to confirm the super call itself still runs.
  @Test
  void noRedirectRestTemplateDelegatesToSuperForRequestMethod() throws Exception {
    ClientHttpRequestFactory factory =
        new TaApplyApplication().noRedirectRestTemplate().getRequestFactory();
    HttpURLConnection connection =
        (HttpURLConnection) new URL("http://localhost/test").openConnection();

    invokePrepareConnection(factory, connection, "POST");

    assertEquals("POST", connection.getRequestMethod());
  }

  // GET is the one method Spring's own super call leaves following redirects (true), so only
  // our explicit override can be responsible for it coming out false here.
  @Test
  void noRedirectRestTemplateOverridesFollowRedirectsForGet() throws Exception {
    ClientHttpRequestFactory factory =
        new TaApplyApplication().noRedirectRestTemplate().getRequestFactory();
    HttpURLConnection connection =
        (HttpURLConnection) new URL("http://localhost/test").openConnection();
    connection.setInstanceFollowRedirects(true);

    invokePrepareConnection(factory, connection, "GET");

    assertFalse(connection.getInstanceFollowRedirects());
  }

  private static void invokePrepareConnection(
      ClientHttpRequestFactory factory, HttpURLConnection connection, String httpMethod)
      throws Exception {
    Class<?> factoryClass = factory.getClass();
    Method prepareConnection =
        factoryClass.getDeclaredMethod("prepareConnection", HttpURLConnection.class, String.class);
    prepareConnection.setAccessible(true);
    prepareConnection.invoke(factory, connection, httpMethod);
  }
}
