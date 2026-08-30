package edu.ucsb.cs.taapply.utilities;

public class CanonicalFormConverter {

  public static String convertToValidEmail(String email) {
    return email.replace("@umail.ucsb.edu", "@ucsb.edu").toLowerCase();
  }

  public static boolean areEquivalentEmails(String email1, String email2) {
    return convertToValidEmail(email1).equals(convertToValidEmail(email2));
  }
}
