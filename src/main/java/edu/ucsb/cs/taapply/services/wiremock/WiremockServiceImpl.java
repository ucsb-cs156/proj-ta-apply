package edu.ucsb.cs.taapply.services.wiremock;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.temporaryRedirect;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.common.ConsoleNotifier;
import com.github.tomakehurst.wiremock.junit.Stubbing;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.wiremock.extension.jwt.JwtExtensionFactory;

@Slf4j
@Service("wiremockService")
@Profile("wiremock")
@ConfigurationProperties
public class WiremockServiceImpl extends WiremockService {

  WireMockServer wireMockServer;

  public WireMockServer getWiremockServer() {
    return wireMockServer;
  }

  public static void setupOauthMocks(Stubbing s, String emailAddress) {
    s.stubFor(
        get(urlPathMatching("/oauth/authorize.*"))
            .willReturn(
                aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "text/html")
                    .withHeader("Set-Cookie", "nonce={{request.query.nonce}};path=/")
                    .withBodyFile("login.html")));

    s.stubFor(
        post(urlPathEqualTo("/login"))
            .willReturn(
                temporaryRedirect(
                    "{{formData request.body 'form' urlDecode=true}}{{{form.redirectUri}}}?code={{{request.cookies.nonce}}}&state={{{form.state}}}")));

    s.stubFor(
        post(urlPathEqualTo("/oauth/token"))
            .willReturn(
                okJson(
                    """
                        {{#trim}}
                        {{formData request.body 'form'}}
                        {{#assign 'emailAddress'}}%s{{/assign}}
                        {{#assign 'subject'}}{{{base64 emailAddress padding=false}}}{{/assign}}
                        {{#assign 'accessToken'}}{{{base64 (stringFormat 'access..%%s' emailAddress) padding=false}}}{{/assign}}
                        {{#assign 'submittedNonce'}}{{form.code}}{{/assign}}
                        {{#assign 'idToken'}}{{#trim}}
                        {{{jwt alg='RS256' email=emailAddress iss=request.baseUrl aud='integrationtest' nonce=submittedNonce sub=subject}}}
                        {{/trim}}{{/assign}}
                        {
                        "access_token":"{{{accessToken}}}",
                        "token_type": "Bearer",
                        "id_token": "{{{idToken}}}"
                        }
                        {{/trim}}"""
                        .formatted(emailAddress))));

    s.stubFor(
        get(urlPathMatching("/userinfo"))
            .willReturn(
                aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody(
                        """
                            {{#trim}}
                            {{#assign 'accessToken'}}{{{regexExtract request.headers.Authorization.0 '[^\\\\s]*$'}}}{{/assign}}
                            {{#assign 'email'}}%s{{/assign}}
                            {{#assign 'sub'}}{{{base64 email padding=false}}}{{/assign}}
                            {
                            "email": "{{{email}}}",
                            "sub": "{{{sub}}}",
                            "name": "Test User",
                            "given_name": "Test",
                            "family_name": "User",
                            "picture": "https://example.com/photo.jpg"
                            }
                            {{/trim}}"""
                            .formatted(emailAddress))));

    s.stubFor(
        get(urlPathMatching("/.well-known/jwks\\.json"))
            .willReturn(
                aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{{{jwks}}}")));
  }

  public void init() {
    log.info("WiremockServiceImpl.init() called");
    WireMockServer server =
        new WireMockServer(
            wireMockConfig()
                .port(8090)
                .globalTemplating(true)
                .extensions(new JwtExtensionFactory())
                .notifier(new ConsoleNotifier(true)));
    setupOauthMocks(server, "admingaucho@ucsb.edu");
    server.start();
    this.wireMockServer = server;
    log.info("WiremockServiceImpl.init() completed");
  }
}
