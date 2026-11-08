import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ESTIMATE_SAVE_DELAY_MS,
  isValidEnrollmentEstimate,
} from "main/utils/allocations";
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

/** What a box saves: the section it stands for, and the course row the save is sent to. */
export type EstimateTarget = { key: string; id: number };

/**
 * Put a saved row into every cached course list as soon as the backend answers, so the stored
 * value is right the moment a box is left, not only after the refetch that follows. The estimate
 * is the quarter's (issue #363), so the other recruitment's row for the same section takes it too.
 */
export const replaceEstimateInCache = (
  queryClient: QueryClient,
  saved: RecruitmentCourse,
) =>
  queryClient.setQueriesData<RecruitmentCourse[]>(
    { queryKey: ["/api/recruitmentcourses/all"] },
    (old) =>
      (old ?? []).map((c) =>
        c.id === saved.id
          ? saved
          : c.enrollCode === saved.enrollCode
            ? { ...c, enrollmentEstimate: saved.enrollmentEstimate }
            : c,
      ),
  );

/**
 * The saving of the Enrollment Estimate boxes (issues #175, #358). A box is a section, and a
 * section has one estimate for the quarter (issue #363), so a save is sent to one of its course
 * rows and the backend sets both recruitments' from it. It is sent a second after the last
 * keystroke rather than on each one, since an estimate is usually several digits; a pending save
 * is kept by section with the value it will send, so leaving the box, or the page, can send it at
 * once instead. An empty box clears the estimate.
 *
 * A save changes more than its row: the backend recomputes both recruitments' allocations from the
 * quarter's estimates, so after each save every cached course list is read again.
 *
 * @param requestHeaders sent with every save, to name this tab to the multi-tab warning
 * @returns what is in each focused box by section key, the change handler and the blur handler
 */
export function useEstimateSaves(
  requestHeaders: Record<string, string> | undefined,
) {
  const queryClient = useQueryClient();
  const [estimateDrafts, setEstimateDrafts] = useState<Record<string, string>>(
    {},
  );
  const pendingEstimates = useRef<
    Record<
      string,
      { timer: ReturnType<typeof setTimeout>; value: string; id: number }
    >
  >({});
  const estimateMutation = useMutation<
    RecruitmentCourse,
    unknown,
    { id: number; value: string }
  >({
    mutationFn: async ({ id, value }) => {
      const response = await axios(estimateRequest(id, value, requestHeaders));
      return response.data as RecruitmentCourse;
    },
    onSuccess: (saved) => replaceEstimateInCache(queryClient, saved),
    onError: (error) => toast(`${error}`),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ["/api/recruitmentcourses/all"],
      }),
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
        id: target.id,
        timer: setTimeout(() => {
          delete pendingEstimates.current[target.key];
          estimateMutation.mutate({ id: target.id, value });
        }, ESTIMATE_SAVE_DELAY_MS),
      };
    }
  };
  const onEstimateBlur = (target: EstimateTarget) => {
    const pending = cancelPendingEstimate(target.key);
    if (pending !== undefined) {
      estimateMutation.mutate({ id: pending.id, value: pending.value });
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
      Object.entries(pending).forEach(([key, { timer, value, id }]) => {
        clearTimeout(timer);
        delete pending[key];
        void axios(estimateRequest(id, value, headersRef.current));
      });
    };
  }, []);
  // Stryker restore all

  return { estimateDrafts, onEstimateChange, onEstimateBlur };
}
