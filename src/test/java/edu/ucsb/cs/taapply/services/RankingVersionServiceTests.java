package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.RankingListVersion;
import edu.ucsb.cs.taapply.repository.RankingListVersionRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class RankingVersionServiceTests {
  @Mock RankingListVersionRepository repository;
  @InjectMocks RankingVersionService service;

  @Test
  void a_course_never_ranked_is_at_version_0() {
    when(repository.findById(5L)).thenReturn(Optional.empty());
    assertEquals(0, service.current(5L));
  }

  @Test
  void a_course_ranked_before_is_at_its_stored_version() {
    when(repository.findById(5L)).thenReturn(Optional.of(new RankingListVersion(5L, 7)));
    assertEquals(7, service.current(5L));
  }

  @Test
  void advancing_from_the_current_version_succeeds() {
    when(repository.advance(5L, 3)).thenReturn(1);
    assertTrue(service.advance(5L, 3));
    verify(repository, never()).create(5L);
  }

  @Test
  void advancing_from_an_old_version_is_refused() {
    when(repository.advance(5L, 3)).thenReturn(0);
    assertFalse(service.advance(5L, 3));
    verify(repository, never()).create(5L);
  }

  @Test
  void advancing_a_nonzero_version_with_no_row_is_refused_without_creating_one() {
    when(repository.advance(5L, 2)).thenReturn(0);
    assertFalse(service.advance(5L, 2));
    verify(repository, never()).existsById(5L);
    verify(repository, never()).create(5L);
  }

  @Test
  void the_first_edit_of_a_course_creates_its_version() {
    when(repository.advance(5L, 0)).thenReturn(0);
    when(repository.existsById(5L)).thenReturn(false);
    assertTrue(service.advance(5L, 0));
    verify(repository).create(5L);
  }

  @Test
  void an_edit_from_version_0_is_refused_once_a_row_exists() {
    when(repository.advance(5L, 0)).thenReturn(0);
    when(repository.existsById(5L)).thenReturn(true);
    assertFalse(service.advance(5L, 0));
    verify(repository, never()).create(5L);
  }

  @Test
  void two_first_edits_at_once_leave_the_loser_refused() {
    when(repository.advance(5L, 0)).thenReturn(0);
    when(repository.existsById(5L)).thenReturn(false);
    when(repository.create(5L)).thenThrow(new DataIntegrityViolationException("duplicate"));
    assertFalse(service.advance(5L, 0));
  }

  @Test
  void bumping_adds_one_to_an_existing_version() {
    when(repository.increment(5L)).thenReturn(1);
    service.bump(5L);
    verify(repository, times(1)).increment(5L);
    verify(repository, never()).create(5L);
  }

  @Test
  void bumping_a_course_with_no_version_starts_it() {
    when(repository.increment(5L)).thenReturn(0);
    service.bump(5L);
    verify(repository, times(1)).increment(5L);
    verify(repository).create(5L);
  }

  @Test
  void bumping_while_another_bump_creates_the_row_adds_one_after_it() {
    when(repository.increment(5L)).thenReturn(0, 1);
    when(repository.create(5L)).thenThrow(new DataIntegrityViolationException("duplicate"));
    service.bump(5L);
    verify(repository, times(2)).increment(5L);
  }
}
