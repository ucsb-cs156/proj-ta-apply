import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ESTIMATE_SAVE_DELAY_MS,
  isValidEnrollmentEstimate,
} from "main/utils/allocations";
import { replaceCourseInCache } from "main/components/Recruitments/useAllocationSaves";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";

/** The request that saves one estimate; shared by the debounced save and the unmount flush. */
export const estimateRequest = (
  id: number,
  value: string,
  headers?: Record<string, string>,
) => ({
  url: "/api/recruitmentcourses/enrollmentEstimate",
  method: "PUT",
  headers,
  // Leaving the parameter out clears the estimate.
  params: value === "" ? { id } : { id, enrollmentEstimate: Number(value) },
});

/** What a box saves: the section it stands for, and the course rows (one per recruitment) it sets. */
export type EstimateTarget = { key: string; ids: number[] };

/**
 * The saving of the Enrollment Estimate boxes (issues #175, #358). A box is a section, and until a
 * course has one estimate per quarter (issue #363) a section in both recruitments has two course
 * rows, so a save is sent to each row and the two agree. It is sent a second after the last
 * keystroke rather than on each one, since an estimate is usually several digits; a pending save
 * is kept by section with the value it will send, so leaving the box, or the page, can send it at
 * once instead. An empty box clears the estimate.
 *
 * @param requestHeaders sent with every save, to name this tab to the multi-tab warning
 * @param includeRemoved part of the query key to invalidate after a save
 * @returns what is in each focused box by section key, the change handler and the blur handler
 */
export function useEstimateSaves(
  requestHeaders: Record<string, string> | undefined,
  includeRemoved: boolean,
) {
  const queryClient = useQueryClient();
  const [estimateDrafts, setEstimateDrafts] = useState<Record<string, string>>(
    {},
  );
  const pendingEstimates = useRef<
    Record<
      string,
      { timer: ReturnType<typeof setTimeout>; value: string; ids: number[] }
    >
  >({});
  const estimateMutation = useMutation<
    RecruitmentCourse[],
    unknown,
    { ids: number[]; value: string }
  >({
    mutationFn: ({ ids, value }) =>
      Promise.all(
        ids.map(async (id) => {
          const response = await axios(
            estimateRequest(id, value, requestHeaders),
          );
          return response.data as RecruitmentCourse;
        }),
      ),
    onSuccess: (saved) =>
      saved.forEach((course) => replaceCourseInCache(queryClient, course)),
    onError: (error) => toast(`${error}`),
    // Stryker disable all : cache invalidation is not observable from here
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/recruitmentcourses/all", includeRemoved],
      }),
    // Stryker restore all
    retry: false,
  });
  const cancelPendingEstimate = (key: string) => {
    const pending = pendingEstimates.current[key];
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      delete pendingEstimates.current[key];
    }
    return pending;
  };
  const onEstimateChange = (target: EstimateTarget, value: string) => {
    setEstimateDrafts((previous) => ({ ...previous, [target.key]: value }));
    cancelPendingEstimate(target.key);
    if (isValidEnrollmentEstimate(value)) {
      pendingEstimates.current[target.key] = {
        value,
        ids: target.ids,
        timer: setTimeout(() => {
          delete pendingEstimates.current[target.key];
          estimateMutation.mutate({ ids: target.ids, value });
        }, ESTIMATE_SAVE_DELAY_MS),
      };
    }
  };
  const onEstimateBlur = (target: EstimateTarget) => {
    const pending = cancelPendingEstimate(target.key);
    if (pending !== undefined) {
      estimateMutation.mutate({ ids: pending.ids, value: pending.value });
    }
    setEstimateDrafts({});
  };

  const headersRef = useRef(requestHeaders);
  // Stryker disable all : the headers never change during a test; the unmount flush is tested
  useEffect(() => {
    headersRef.current = requestHeaders;
  }, [requestHeaders]);
  // Stryker restore all
  // Leaving the page within the second still saves: the pending requests are sent directly, since
  // the component's mutation is gone with it. The ref's contents are mutated in place, never
  // replaced, so the object captured here is the live one.
  // Stryker disable all : any constant dependency list registers the flush once; the flush
  // itself is tested
  useEffect(() => {
    const pending = pendingEstimates.current;
    return () => {
      Object.entries(pending).forEach(([key, { timer, value, ids }]) => {
        clearTimeout(timer);
        delete pending[key];
        ids.forEach(
          (id) => void axios(estimateRequest(id, value, headersRef.current)),
        );
      });
    };
  }, []);
  // Stryker restore all

  return { estimateDrafts, onEstimateChange, onEstimateBlur };
}
