package edu.ucsb.cs.taapply.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

public class ClientIdentityTests {

  @Test
  public void it_keeps_the_key_and_the_label() {
    ClientIdentity who = new ClientIdentity("ada@example.org", "ada@example.org (Ada Lovelace)");
    assertEquals("ada@example.org", who.personKey());
    assertEquals("ada@example.org (Ada Lovelace)", who.label());
  }

  @Test
  public void a_person_is_not_an_admin_unless_said_to_be() {
    assertEquals(false, new ClientIdentity("k", "Ada").admin());
    assertEquals(false, new ClientIdentity("k", "Ada", false).admin());
    assertEquals(true, new ClientIdentity("k", "Ada", true).admin());
  }

  @Test
  public void a_missing_or_blank_label_becomes_the_key() {
    assertEquals("ada@example.org", new ClientIdentity("ada@example.org", null).label());
    assertEquals("ada@example.org", new ClientIdentity("ada@example.org", "").label());
    assertEquals("ada@example.org", new ClientIdentity("ada@example.org", "   ").label());
  }

  @Test
  public void a_key_is_required() {
    assertThrows(IllegalArgumentException.class, () -> new ClientIdentity(null, "Ada"));
    assertThrows(IllegalArgumentException.class, () -> new ClientIdentity("", "Ada"));
    assertThrows(IllegalArgumentException.class, () -> new ClientIdentity("  ", "Ada"));
  }

  @Test
  public void a_label_of_the_longest_length_is_kept_whole() {
    String longest = "n".repeat(ClientIdentity.MAX_LABEL_LENGTH);
    assertEquals(longest, new ClientIdentity("k", longest).label());
  }

  @Test
  public void a_label_one_longer_is_cut_short_with_an_ellipsis_to_the_longest_length() {
    String tooLong = "n".repeat(ClientIdentity.MAX_LABEL_LENGTH + 1);

    String label = new ClientIdentity("k", tooLong).label();

    assertEquals(ClientIdentity.MAX_LABEL_LENGTH, label.length());
    assertEquals("n".repeat(ClientIdentity.MAX_LABEL_LENGTH - 1) + "…", label);
  }

  @Test
  public void a_very_long_label_is_cut_short_too() {
    assertEquals(
        ClientIdentity.MAX_LABEL_LENGTH,
        new ClientIdentity("k", "n".repeat(10_000)).label().length());
  }

  @Test
  public void a_label_is_never_cut_in_the_middle_of_a_character() {
    // 😀 is one character made of two chars; 300 of them are cut after 199, not after 199 chars.
    String emoji = "😀".repeat(300);

    String label = new ClientIdentity("k", emoji).label();

    assertEquals("😀".repeat(ClientIdentity.MAX_LABEL_LENGTH - 1) + "…", label);
    assertEquals(ClientIdentity.MAX_LABEL_LENGTH, label.codePointCount(0, label.length()));
  }

  @Test
  public void the_longest_length_is_two_hundred() {
    assertEquals(200, ClientIdentity.MAX_LABEL_LENGTH);
  }
}
