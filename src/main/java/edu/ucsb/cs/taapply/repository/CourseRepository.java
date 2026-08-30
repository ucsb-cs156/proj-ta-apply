package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Course;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CourseRepository extends CrudRepository<Course, String> {
  Optional<Course> findByCourseId(String courseId);

  boolean existsByCourseId(String courseId);

  List<Course> findAllByOrderByCourseIdAsc();
}
