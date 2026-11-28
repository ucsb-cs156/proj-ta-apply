package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.HiringRecord;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.HiringField;
import edu.ucsb.cs.taapply.enums.NewHireForm;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.HiringRecordRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Issue #509: saving the Soft Offer Results page's hiring-tracking fields, one at a time. */
@ExtendWith(MockitoExtension.class)
class HiringRecordsServiceTests {
  @Mock ApplicationRepository applicationRepository;
  @Mock HiringRecordRepository hiringRecordRepository;
  @Mock CurrentUserService currentUserService;
  @InjectMocks HiringRecordsService service;

  private static final long APPLICATION = 7L;
  private static final LocalDateTime BEFORE = LocalDateTime.of(2026, 11, 20, 9, 30);
  private static final String STAFF = "staff@ucsb.edu";

  private LocalDateTime started;

  @BeforeEach
  void setUp() {
    started = AppTime.now().minusSeconds(1);
    lenient().when(applicationRepository.existsById(APPLICATION)).thenReturn(true);
    lenient()
        .when(currentUserService.getUser())
        .thenReturn(User.builder().id(3L).email(STAFF).build());
    lenient().when(hiringRecordRepository.save(any())).thenAnswer(i -> i.getArgument(0));
  }

  /** A record the staff have saved before, every field set. */
  private static HiringRecord existing() {
    return HiringRecord.builder()
        .id(1L)
        .applicationId(APPLICATION)
        .formalOfferSentAt(BEFORE)
        .formalOfferAcceptedAt(BEFORE)
        .newHireForm(NewHireForm.DONE)
        .newHireFormAt(BEFORE)
        .flsaConflictFoundAt(BEFORE)
        .flsaConflictResolvedAt(BEFORE)
        .inUcpathAt(BEFORE)
        .i9CompleteAt(BEFORE)
        .fundingSource("TA")
        .staffComments("Called HR")
        .updatedAt(BEFORE)
        .updatedByEmail("other@ucsb.edu")
        .build();
  }

  private HiringRecord update(HiringRecord current, HiringField field, String value) {
    when(hiringRecordRepository.findByApplicationId(APPLICATION))
        .thenReturn(Optional.ofNullable(current));
    return service.update(APPLICATION, field, value);
  }

  /** Within the test's run, so the server's clock and not some fixed or client time. */
  private void assertNow(LocalDateTime stamp) {
    assertNotNull(stamp);
    assertFalse(stamp.isBefore(started), stamp + " is before the test started");
    assertFalse(stamp.isAfter(AppTime.now().plusSeconds(1)), stamp + " is in the future");
  }

  private static LocalDateTime stampOf(HiringRecord record, HiringField field) {
    return switch (field) {
      case FORMAL_OFFER_SENT -> record.getFormalOfferSentAt();
      case FORMAL_OFFER_ACCEPTED -> record.getFormalOfferAcceptedAt();
      case FLSA_CONFLICT_FOUND -> record.getFlsaConflictFoundAt();
      case FLSA_CONFLICT_RESOLVED -> record.getFlsaConflictResolvedAt();
      case IN_UCPATH -> record.getInUcpathAt();
      case I9_COMPLETE -> record.getI9CompleteAt();
      default -> throw new IllegalArgumentException("not a checkbox: " + field);
    };
  }

  private static void clearStamp(HiringRecord record, HiringField field) {
    switch (field) {
      case FORMAL_OFFER_SENT -> record.setFormalOfferSentAt(null);
      case FORMAL_OFFER_ACCEPTED -> record.setFormalOfferAcceptedAt(null);
      case FLSA_CONFLICT_FOUND -> record.setFlsaConflictFoundAt(null);
      case FLSA_CONFLICT_RESOLVED -> record.setFlsaConflictResolvedAt(null);
      case IN_UCPATH -> record.setInUcpathAt(null);
      case I9_COMPLETE -> record.setI9CompleteAt(null);
      default -> throw new IllegalArgumentException("not a checkbox: " + field);
    }
  }

  private static final String[] CHECKBOXES = {
    "FORMAL_OFFER_SENT",
    "FORMAL_OFFER_ACCEPTED",
    "FLSA_CONFLICT_FOUND",
    "FLSA_CONFLICT_RESOLVED",
    "IN_UCPATH",
    "I9_COMPLETE"
  };

  // ---- the record ----

  @Test
  void the_first_save_creates_the_record_for_the_application_and_says_who_and_when() {
    HiringRecord saved = update(null, HiringField.FORMAL_OFFER_SENT, "true");

    assertNull(saved.getId());
    assertEquals(APPLICATION, saved.getApplicationId());
    assertNow(saved.getFormalOfferSentAt());
    assertEquals(saved.getFormalOfferSentAt(), saved.getUpdatedAt());
    assertEquals(STAFF, saved.getUpdatedByEmail());
    // Nothing else is set on a fresh record.
    assertNull(saved.getFormalOfferAcceptedAt());
    assertNull(saved.getNewHireForm());
    assertNull(saved.getNewHireFormAt());
    assertNull(saved.getFlsaConflictFoundAt());
    assertNull(saved.getFlsaConflictResolvedAt());
    assertNull(saved.getInUcpathAt());
    assertNull(saved.getI9CompleteAt());
    assertNull(saved.getFundingSource());
    assertNull(saved.getStaffComments());
    verify(hiringRecordRepository).save(saved);
  }

  @Test
  void a_later_save_updates_the_existing_record_and_restamps_who_and_when() {
    HiringRecord current = existing();

    HiringRecord saved = update(current, HiringField.IN_UCPATH, "false");

    assertSame(current, saved);
    assertEquals(1L, saved.getId());
    assertNull(saved.getInUcpathAt());
    assertNow(saved.getUpdatedAt());
    assertEquals(STAFF, saved.getUpdatedByEmail());
    // The other fields are untouched: one PUT per field never overwrites another.
    assertEquals(BEFORE, saved.getFormalOfferSentAt());
    assertEquals(BEFORE, saved.getFormalOfferAcceptedAt());
    assertEquals(NewHireForm.DONE, saved.getNewHireForm());
    assertEquals(BEFORE, saved.getNewHireFormAt());
    assertEquals(BEFORE, saved.getFlsaConflictFoundAt());
    assertEquals(BEFORE, saved.getFlsaConflictResolvedAt());
    assertEquals(BEFORE, saved.getI9CompleteAt());
    assertEquals("TA", saved.getFundingSource());
    assertEquals("Called HR", saved.getStaffComments());
    verify(hiringRecordRepository).save(current);
  }

  @Test
  void an_unknown_application_is_not_found_and_nothing_is_saved() {
    when(applicationRepository.existsById(9L)).thenReturn(false);

    EntityNotFoundException e =
        assertThrows(
            EntityNotFoundException.class,
            () -> service.update(9L, HiringField.FORMAL_OFFER_SENT, "true"));

    assertEquals("Application with id 9 not found", e.getMessage());
    verify(hiringRecordRepository, never()).findByApplicationId(any());
    verify(hiringRecordRepository, never()).save(any());
  }

  @Test
  void with_no_signed_in_user_the_editor_is_recorded_as_unknown() {
    when(currentUserService.getUser()).thenReturn(null);

    HiringRecord saved = update(null, HiringField.FUNDING_SOURCE, "TA");

    assertNull(saved.getUpdatedByEmail());
    assertNow(saved.getUpdatedAt());
  }

  // ---- the six checkboxes ----

  @ParameterizedTest
  @EnumSource(
      value = HiringField.class,
      names = {
        "FORMAL_OFFER_SENT",
        "FORMAL_OFFER_ACCEPTED",
        "FLSA_CONFLICT_FOUND",
        "FLSA_CONFLICT_RESOLVED",
        "IN_UCPATH",
        "I9_COMPLETE"
      })
  void checking_an_unchecked_box_stamps_it_now(HiringField field) {
    HiringRecord current = existing();
    clearStamp(current, field);

    HiringRecord saved = update(current, field, "true");

    assertNow(stampOf(saved, field));
    assertEquals(stampOf(saved, field), saved.getUpdatedAt());
  }

  @ParameterizedTest
  @EnumSource(
      value = HiringField.class,
      names = {
        "FORMAL_OFFER_SENT",
        "FORMAL_OFFER_ACCEPTED",
        "FLSA_CONFLICT_FOUND",
        "FLSA_CONFLICT_RESOLVED",
        "IN_UCPATH",
        "I9_COMPLETE"
      })
  void checking_a_checked_box_again_keeps_its_stamp(HiringField field) {
    HiringRecord saved = update(existing(), field, "TRUE");

    assertEquals(BEFORE, stampOf(saved, field));
    assertNow(saved.getUpdatedAt());
  }

  @ParameterizedTest
  @EnumSource(
      value = HiringField.class,
      names = {
        "FORMAL_OFFER_SENT",
        "FORMAL_OFFER_ACCEPTED",
        "FLSA_CONFLICT_FOUND",
        "FLSA_CONFLICT_RESOLVED",
        "IN_UCPATH",
        "I9_COMPLETE"
      })
  void unchecking_a_box_clears_its_stamp(HiringField field) {
    HiringRecord saved = update(existing(), field, "False");

    assertNull(stampOf(saved, field));
    verify(hiringRecordRepository).save(saved);
  }

  @ParameterizedTest
  @EnumSource(
      value = HiringField.class,
      names = {
        "FORMAL_OFFER_SENT",
        "FORMAL_OFFER_ACCEPTED",
        "FLSA_CONFLICT_FOUND",
        "FLSA_CONFLICT_RESOLVED",
        "IN_UCPATH",
        "I9_COMPLETE"
      })
  void a_box_takes_only_true_or_false(HiringField field) {
    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> update(existing(), field, "yes"));
    assertEquals(HiringRecordsService.CHECKBOX_VALUE, e.getMessage());
    assertThrows(IllegalArgumentException.class, () -> service.update(APPLICATION, field, null));
    assertThrows(IllegalArgumentException.class, () -> service.update(APPLICATION, field, ""));
    verify(hiringRecordRepository, never()).save(any());
  }

  @Test
  void the_checkbox_list_covers_every_field_but_the_three_others() {
    assertEquals(HiringField.values().length - 3, CHECKBOXES.length);
  }

  // ---- the New Hire form dropdown ----

  @Test
  void choosing_a_new_hire_form_value_sets_it_and_stamps_it_now() {
    HiringRecord current = existing();
    current.setNewHireForm(null);
    current.setNewHireFormAt(null);

    HiringRecord saved = update(current, HiringField.NEW_HIRE_FORM, "NOT_NEEDED");

    assertEquals(NewHireForm.NOT_NEEDED, saved.getNewHireForm());
    assertNow(saved.getNewHireFormAt());
  }

  @Test
  void changing_the_new_hire_form_value_stamps_it_again() {
    HiringRecord saved = update(existing(), HiringField.NEW_HIRE_FORM, "NOT_NEEDED");

    assertEquals(NewHireForm.NOT_NEEDED, saved.getNewHireForm());
    assertNotEquals(BEFORE, saved.getNewHireFormAt());
    assertNow(saved.getNewHireFormAt());
  }

  @Test
  void saving_the_same_new_hire_form_value_again_keeps_its_stamp() {
    HiringRecord saved = update(existing(), HiringField.NEW_HIRE_FORM, "DONE");

    assertEquals(NewHireForm.DONE, saved.getNewHireForm());
    assertEquals(BEFORE, saved.getNewHireFormAt());
  }

  @Test
  void a_new_hire_form_value_with_no_stamp_is_stamped_when_saved_again() {
    HiringRecord current = existing();
    current.setNewHireFormAt(null);

    HiringRecord saved = update(current, HiringField.NEW_HIRE_FORM, "DONE");

    assertEquals(NewHireForm.DONE, saved.getNewHireForm());
    assertNow(saved.getNewHireFormAt());
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"   "})
  void a_blank_new_hire_form_clears_the_value_and_its_stamp(String value) {
    HiringRecord saved = update(existing(), HiringField.NEW_HIRE_FORM, value);

    assertNull(saved.getNewHireForm());
    assertNull(saved.getNewHireFormAt());
    verify(hiringRecordRepository).save(saved);
  }

  @Test
  void the_new_hire_form_takes_only_its_two_values_or_blank() {
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> update(existing(), HiringField.NEW_HIRE_FORM, "Done"));
    assertEquals(HiringRecordsService.NEW_HIRE_FORM_VALUE, e.getMessage());
    assertEquals("New Hire form takes [DONE, NOT_NEEDED] or blank.", e.getMessage());
    verify(hiringRecordRepository, never()).save(any());
  }

  // ---- Staff Comments ----

  @Test
  void staff_comments_are_stored_as_typed() {
    HiringRecord saved = update(existing(), HiringField.STAFF_COMMENTS, "  Call \"HR\" \n");

    assertEquals("  Call \"HR\" \n", saved.getStaffComments());
    assertEquals(BEFORE, saved.getInUcpathAt());
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" \t "})
  void blank_staff_comments_are_stored_as_nothing(String value) {
    HiringRecord saved = update(existing(), HiringField.STAFF_COMMENTS, value);

    assertNull(saved.getStaffComments());
  }

  @Test
  void staff_comments_may_be_4000_characters_but_not_4001() {
    String longest = "x".repeat(SoftOffersService.COMMENTS_MAX);
    HiringRecord saved = update(null, HiringField.STAFF_COMMENTS, longest);
    assertEquals(longest, saved.getStaffComments());

    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.update(APPLICATION, HiringField.STAFF_COMMENTS, longest + "y"));
    assertEquals(HiringRecordsService.STAFF_COMMENTS_TOO_LONG, e.getMessage());
    assertEquals("Staff Comments may be at most 4000 characters.", e.getMessage());
    verify(hiringRecordRepository).save(saved);
  }

  // ---- Funding ----

  @Test
  void the_funding_source_is_stored_as_given_until_issue_512_checks_it() {
    HiringRecord saved = update(existing(), HiringField.FUNDING_SOURCE, "GSR");

    assertEquals("GSR", saved.getFundingSource());
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"  "})
  void a_blank_funding_source_clears_it(String value) {
    HiringRecord saved = update(existing(), HiringField.FUNDING_SOURCE, value);

    assertNull(saved.getFundingSource());
  }

  // ---- the helpers on their own ----

  @Test
  void stamp_keeps_a_stamp_on_true_sets_now_when_there_is_none_and_clears_on_false() {
    LocalDateTime now = LocalDateTime.of(2026, 11, 27, 12, 0);
    assertEquals(now, HiringRecordsService.stamp(null, "true", now));
    assertEquals(BEFORE, HiringRecordsService.stamp(BEFORE, "true", now));
    assertNull(HiringRecordsService.stamp(BEFORE, "false", now));
    assertNull(HiringRecordsService.stamp(null, "false", now));
    assertThrows(IllegalArgumentException.class, () -> HiringRecordsService.stamp(null, "1", now));
  }

  @Test
  void checkbox_refuses_a_field_that_is_not_a_checkbox() {
    HiringRecord record = existing();
    LocalDateTime now = LocalDateTime.of(2026, 11, 27, 12, 0);
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class,
            () -> HiringRecordsService.checkbox(record, HiringField.STAFF_COMMENTS, "true", now));
    assertEquals("STAFF_COMMENTS is not a checkbox field.", e.getMessage());
    assertEquals(existing(), record);
  }

  @Test
  void newHireForm_reads_the_enum_names_and_blank() {
    assertEquals(NewHireForm.DONE, HiringRecordsService.newHireForm("DONE"));
    assertEquals(NewHireForm.NOT_NEEDED, HiringRecordsService.newHireForm("NOT_NEEDED"));
    assertNull(HiringRecordsService.newHireForm(null));
    assertNull(HiringRecordsService.newHireForm(""));
    assertThrows(
        IllegalArgumentException.class, () -> HiringRecordsService.newHireForm("not needed"));
  }
}
