package edu.ucsb.cs.taapply.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URL;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@Profile("development")
@RestController
public class FrontendProxyController {

  private static final String PROXY_ROUTE_PATTERN =
      "/{path:^(?!api|oauth2|swagger-ui|h2-console).*}/**";
  private static final Set<String> ALLOWED_PROXY_HOSTS = Set.of("127.0.0.1", "localhost", "::1");
  private static final int CONNECT_TIMEOUT_MS = 2000;
  private static final int READ_TIMEOUT_MS = 5000;
  private static final int MAX_PROXY_RESPONSE_BYTES = 5 * 1024 * 1024;
  private static final String FRONTEND_UNAVAILABLE_INSTRUCTIONS =
      """
            <p>Failed to connect to the frontend server...</p>
            <p>When running locally, open a second terminal window, cd into <code>frontend</code> and run: <code>npm install; npm run dev</code></p>
            <p>Or, you may click to access:</p>
            <ul>
              <li><a href='/swagger-ui/index.html'>/swagger-ui/index.html</a></li>
              <li><a href='/h2-console'>/h2-console</a></li>
            </ul>""";

  @Value("${frontend.proxy.url:http://127.0.0.1:3000}")
  private String frontendProxyUrl;

  @GetMapping({"/", PROXY_ROUTE_PATTERN})
  public ResponseEntity<?> proxy(HttpServletRequest request) {
    URI frontendBaseUri = URI.create(frontendProxyUrl);
    String proxyHost = frontendBaseUri.getHost();
    if (proxyHost == null || !ALLOWED_PROXY_HOSTS.contains(proxyHost)) {
      throw new IllegalStateException("frontend.proxy.url must use a local loopback host");
    }

    String requestPath = request.getRequestURI();
    String targetUrl =
        UriComponentsBuilder.fromUri(frontendBaseUri)
            .path(requestPath)
            .query(request.getQueryString())
            .build(true)
            .toUriString();
    URI targetUri = URI.create(targetUrl);
    if (!ALLOWED_PROXY_HOSTS.contains(targetUri.getHost())) {
      throw new IllegalStateException("frontend.proxy.url must use a local loopback host");
    }

    try {
      HttpURLConnection connection = (HttpURLConnection) new URL(targetUrl).openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
      connection.setReadTimeout(READ_TIMEOUT_MS);

      int statusCode = connection.getResponseCode();
      InputStream rawStream;
      if (statusCode >= 400) {
        rawStream = connection.getErrorStream();
      } else {
        try {
          rawStream = connection.getInputStream();
        } catch (IOException e) {
          rawStream = connection.getErrorStream();
          if (rawStream == null) {
            throw e;
          }
        }
      }
      byte[] body;
      try (InputStream stream = rawStream) {
        body = stream == null ? new byte[0] : readResponseBytes(stream);
      } finally {
        connection.disconnect();
      }

      ResponseEntity.BodyBuilder responseBuilder = ResponseEntity.status(statusCode);
      String contentType = connection.getContentType();
      if (contentType != null && !contentType.isBlank()) {
        responseBuilder.contentType(MediaType.parseMediaType(contentType));
      }
      return responseBuilder.body(body);
    } catch (ConnectException | SocketTimeoutException e) {
      return ResponseEntity.ok(FRONTEND_UNAVAILABLE_INSTRUCTIONS);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to proxy request to frontend", e);
    }
  }

  private byte[] readResponseBytes(InputStream inputStream) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int totalRead = 0;
    int read;
    while ((read = inputStream.read(buffer)) != -1) {
      totalRead += read;
      if (totalRead > MAX_PROXY_RESPONSE_BYTES) {
        throw new IOException("Frontend proxy response exceeded max allowed size");
      }
      output.write(buffer, 0, read);
    }
    return output.toByteArray();
  }
}
