package edu.ucsb.cs.taapply.models;

/**
 * Issue #417: a student who has both a draft and a finalized (not cancelled) application to the
 * same recruitment, which is not supposed to be possible: submitting an application deletes the
 * draft, and a draft cannot be opened or saved once there is an application. The admin's
 * Applications and Draft Applications pages list these as a warning; nothing repairs them.
 */
public record DraftConflict(String email, Long draftApplicationId, Long applicationId) {}
