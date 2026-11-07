import { useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useBackendMutation } from "main/utils/useBackend";
import { isValidAllocation } from "main/utils/allocations";
import { apiErrorMessage } from "main/utils/apiError";
import { toast } from "react-toastify";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";

/** What a refused allocation save (409) carries. */
type ConflictError = {
  response?: { status?: number; data?: { course?: RecruitmentCourse } };
};

/**
 * Put a saved row into every cached course list as soon as the backend answers, so the stored
 * value is right the moment a box is left, not only after the refetch that follows.
 */
export const replaceCourseInCache = (
  queryClient: QueryClient,
  saved: RecruitmentCourse,
) =>
  queryClient.setQueriesData<RecruitmentCourse[]>(
    { queryKey: ["/api/recruitmentcourses/all"] },
    // Stryker disable next-line all : the query's initial data is an empty list, never undefined
    (old) => (old ?? []).map((c) => (c.id === saved.id ? saved : c)),
  );

/**
 * The saving of the Allocation boxes of one recruitment's courses (issues #174, #278), shared by
 * the Recruitment Courses page and the Combined Allocation page (issue #358), so both go through
 * the same endpoint with the same version checks.
 *
 * Each allocation save carries the version the row had when the save was made, so the saves of one
 * box, one per keystroke, are sent one after the other, each with the version the one before it
 * came back with. A refused save (409) ends the run: what was typed after it was made against
 * numbers that are no longer there, so it is not sent.
 *
 * @param requestHeaders sent with every save, to name this tab to the multi-tab warning
 * @param allocationBulkVersion the recruitment's Auto Allocate count, sent with each edit
 * @param includeRemoved part of the query key to invalidate after a save
 * @returns what is in each focused box by row id, the change handler and the blur handler
 */
export function useAllocationSaves(
  requestHeaders: Record<string, string> | undefined,
  allocationBulkVersion: number | undefined,
  includeRemoved: boolean,
) {
  // What is in each row's Allocation box while it has focus, by row id (issue #174); a row that
  // is absent shows its stored value. Cleared on blur, so an invalid entry reverts and a saved
  // one is simply the stored value again.
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<number, string>
  >({});
  const queryClient = useQueryClient();
  const versions = useRef<Record<number, number>>({});
  const allocationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef(0);
  const epoch = useRef(0);
  const allocationMutation = useBackendMutation<
    { id: number; allocation: number; expectedVersion?: number },
    RecruitmentCourse
  >(
    ({ id, allocation, expectedVersion }) => ({
      url: "/api/recruitmentcourses/allocation",
      method: "PUT",
      headers: requestHeaders,
      params: {
        id,
        allocation,
        expectedVersion,
        expectedBulkVersion: allocationBulkVersion,
      },
    }),
    {
      onSuccess: (saved) => {
        // Stryker disable next-line ConditionalExpression : an answer without a version leaves the row's own
        if (saved.allocationVersion !== undefined) {
          versions.current[saved.id] = saved.allocationVersion;
        }
        replaceCourseInCache(queryClient, saved);
      },
      onError: (error) => {
        if ((error as ConflictError).response?.status !== 409) {
          toast(`${error}`);
          return;
        }
        // Stryker disable next-line AssignmentOperator : any change of the number ends the run
        epoch.current += 1;
        toast(apiErrorMessage(error));
        setAllocationDrafts({});
        // Stryker disable next-line OptionalChaining : a 409 always has a response
        const body = (error as ConflictError).response?.data;
        if (body?.course !== undefined) {
          replaceCourseInCache(queryClient, body.course);
        }
        // After a bulk change every old number is suspect, so everything is read again.
        queryClient.invalidateQueries({
          queryKey: ["/api/recruitmentcourses/all"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/recruitments/all"],
        });
      },
    },
    ["/api/recruitmentcourses/all", includeRemoved],
  );
  const onAllocationChange = (course: RecruitmentCourse, value: string) => {
    setAllocationDrafts((previous) => ({ ...previous, [course.id]: value }));
    if (isValidAllocation(value)) {
      const myEpoch = epoch.current;
      waiting.current += 1;
      allocationQueue.current = allocationQueue.current
        .then(() =>
          myEpoch !== epoch.current
            ? undefined
            : allocationMutation.mutateAsync({
                id: course.id,
                allocation: Number(value),
                expectedVersion:
                  versions.current[course.id] ?? course.allocationVersion,
              }),
        )
        .catch(() => undefined)
        .finally(() => {
          waiting.current -= 1;
          // Between runs the versions come from the rows as last read, which may be newer.
          if (waiting.current === 0) {
            versions.current = {};
          }
        });
    }
  };
  // Only the focused box can have a draft, since leaving a box clears it, so clearing them all
  // on blur is the same as clearing the one.
  const onAllocationBlur = () => setAllocationDrafts({});

  return { allocationDrafts, onAllocationChange, onAllocationBlur };
}
