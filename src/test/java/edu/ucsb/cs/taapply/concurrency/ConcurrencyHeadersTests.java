package edu.ucsb.cs.taapply.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

public class ConcurrencyHeadersTests {

  @Test
  public void the_header_name_is_the_one_the_client_uses() {
    assertEquals("X-Client-Id", ConcurrencyHeaders.CLIENT_ID);
  }

  @Test
  public void a_uuid_is_usable() {
    assertTrue(ConcurrencyHeaders.usable(UUID.randomUUID().toString()));
  }

  @Test
  public void missing_or_blank_is_not_usable() {
    assertFalse(ConcurrencyHeaders.usable(null));
    assertFalse(ConcurrencyHeaders.usable(""));
    assertFalse(ConcurrencyHeaders.usable("  "));
  }

  @Test
  public void the_longest_allowed_is_usable_and_one_more_is_not() {
    assertTrue(ConcurrencyHeaders.usable("x".repeat(ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH)));
    assertFalse(ConcurrencyHeaders.usable("x".repeat(ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH + 1)));
  }

  @Test
  public void the_longest_allowed_is_one_hundred() {
    assertEquals(100, ConcurrencyHeaders.MAX_CLIENT_ID_LENGTH);
  }
}
