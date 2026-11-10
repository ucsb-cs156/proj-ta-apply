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
 * A box being edited, from its first keystroke until it loses focus, keeps the row's version and
 * the recruitment's Auto Allocate count it started from (issue #426): a background refresh that
 * brings newer ones, because someone changed the row or ran Auto Allocate in another tab, does not
 * move them, so the next save is still refused. Only this tab's own saves move the row's version
 * on, including a save that was still on its way when the box was left and entered again. A box
 * that is not being edited saves from the rows as last read.
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
  // What each row being edited started from (issue #426), by row id; the row's version is moved
  // on by each of this tab's own saves of it.
  const pins = useRef<
    Record<number, { version?: number; bulkVersion?: number }>
  >({});
  const allocationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const epoch = useRef(0);
  const allocationMutation = useBackendMutation<
    {
      id: number;
      allocation: number;
      expectedVersion?: number;
      expectedBulkVersion?: number;
    },
    RecruitmentCourse
  >(
    ({ id, allocation, expectedVersion, expectedBulkVersion }) => ({
      url: "/api/recruitmentcourses/allocation",
      method: "PUT",
      headers: requestHeaders,
      params: {
        id,
        allocation,
        expectedVersion,
        expectedBulkVersion,
      },
    }),
    {
      onSuccess: (saved) => {
        // The box may have been left since and its pin let go; a box entered again before this
        // answer came has a new pin, which this save moves on too.
        const pin = pins.current[saved.id];
        // Stryker disable next-line ConditionalExpression : an answer without a version leaves the row's own
        if (pin !== undefined && saved.allocationVersion !== undefined) {
          pin.version = saved.allocationVersion;
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
        // What was typed is dropped, so the next keystroke starts from the row as it now is.
        pins.current = {};
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
    // The first keystroke in a box pins what the row showed, valid or not.
    pins.current[course.id] ??= {
      version: course.allocationVersion,
      bulkVersion: allocationBulkVersion,
    };
    const pin = pins.current[course.id];
    if (isValidAllocation(value)) {
      const myEpoch = epoch.current;
      allocationQueue.current = allocationQueue.current
        .then(() =>
          myEpoch !== epoch.current
            ? undefined
            : allocationMutation.mutateAsync({
                id: course.id,
                allocation: Number(value),
                expectedVersion: pin.version,
                expectedBulkVersion: pin.bulkVersion,
              }),
        )
        .catch(() => undefined);
    }
  };
  // Only the focused box can have a draft, since leaving a box clears it, so clearing them all
  // on blur is the same as clearing the one. The pins go with them: the saves already made keep the
  // pins they took, and the next keystroke starts from the rows as last read, which may be newer.
  const onAllocationBlur = () => {
    setAllocationDrafts({});
    pins.current = {};
  };

  return { allocationDrafts, onAllocationChange, onAllocationBlur };
}
