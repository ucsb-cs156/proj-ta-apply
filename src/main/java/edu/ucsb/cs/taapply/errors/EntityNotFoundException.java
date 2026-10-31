package edu.ucsb.cs.taapply.errors;

public class EntityNotFoundException extends RuntimeException {
  public EntityNotFoundException(Class<?> entityType, Object id) {
    super("%s with id %s not found".formatted(entityType.getSimpleName(), id.toString()));
  }

  /** For an entity looked up by something other than its id. */
  public EntityNotFoundException(String message) {
    super(message);
  }
}
