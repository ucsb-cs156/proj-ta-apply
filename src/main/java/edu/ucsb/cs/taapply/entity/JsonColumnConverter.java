package edu.ucsb.cs.taapply.entity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import java.util.function.Supplier;

/**
 * Stores a collection as JSON text in one column.
 *
 * <p>Used by {@link DraftApplication}, whose collections (prior coursework, topic ratings, interest
 * levels, course interests) are only ever read and written whole, so they need no tables of their
 * own. A null or blank column reads back as an empty collection, never as null, so the form always
 * has something to iterate over.
 */
public abstract class JsonColumnConverter<T> implements AttributeConverter<T, String> {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final TypeReference<T> type;
  private final Supplier<T> empty;

  protected JsonColumnConverter(TypeReference<T> type, Supplier<T> empty) {
    this.type = type;
    this.empty = empty;
  }

  @Override
  public String convertToDatabaseColumn(T value) {
    if (value == null) {
      return null;
    }
    try {
      return MAPPER.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Could not write the collection as JSON", e);
    }
  }

  @Override
  public T convertToEntityAttribute(String json) {
    if (json == null || json.isBlank()) {
      return empty.get();
    }
    try {
      return MAPPER.readValue(json, type);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Could not read the collection from JSON", e);
    }
  }
}
