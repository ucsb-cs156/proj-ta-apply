import type { Application } from "main/components/Applications/ApplicationTable";

const keepKeys = <V>(
  answers: Record<string, V> | null | undefined,
  allowed: string[],
): Record<string, V> =>
  Object.fromEntries(
    Object.entries(answers ?? {}).filter(([key]) => allowed.includes(key)),
  );

/**
 * Issue #307: the answers from an earlier application that make sense for this recruitment. The
 * course and topic answers are keyed by name, and quarter to quarter (and between TA and ULA
 * recruitments) the lists differ, so only the answers for courses, topics and interest areas that
 * this recruitment also has are kept; the rest are dropped. A course choice that is not offered is
 * cleared along with its availability answers, which belong to that course.
 */
export function carryOverTo(
  earlier: Application,
  courses: string[],
  topics: string[],
  interests: string[],
): Application {
  const first = courses.includes(earlier.firstChoiceCourse ?? "");
  const second = courses.includes(earlier.secondChoiceCourse ?? "");
  return {
    ...earlier,
    firstChoiceCourse: first ? earlier.firstChoiceCourse : null,
    secondChoiceCourse: second ? earlier.secondChoiceCourse : null,
    availableForLecturesFirstChoice:
      first && earlier.availableForLecturesFirstChoice,
    availableForDiscussionFirstChoice:
      first && earlier.availableForDiscussionFirstChoice,
    availabilityCommentsFirstChoice: first
      ? earlier.availabilityCommentsFirstChoice
      : null,
    availableForLecturesSecondChoice:
      second && earlier.availableForLecturesSecondChoice,
    availableForDiscussionSecondChoice:
      second && earlier.availableForDiscussionSecondChoice,
    availabilityCommentsSecondChoice: second
      ? earlier.availabilityCommentsSecondChoice
      : null,
    courseInterests: keepKeys(earlier.courseInterests, courses),
    topicProficiencies: keepKeys(earlier.topicProficiencies, topics),
    interests: keepKeys(earlier.interests, interests),
  };
}
