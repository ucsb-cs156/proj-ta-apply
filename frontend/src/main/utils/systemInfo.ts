import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { setAppTimeZone } from "main/utils/pacificTime";

export interface SystemInfo {
  springH2ConsoleEnabled: boolean;
  showSwaggerUILink: boolean;
  /** Whether the Developer Mode switch exists on this instance (issue #217). */
  enableDeveloperMode?: boolean;
  oauthLogin: string;
  sourceRepo: string;
  commitId?: string;
  commitMessage?: string;
  githubUrl?: string;
  subjectArea?: string;
  /**
   * The zone every date and time the app shows is in, an IANA id such as "America/Los_Angeles":
   * the backend's app.timeZone (APP_TIME_ZONE), Pacific unless configured (issue #513). Handed to
   * setAppTimeZone in utils/pacificTime as soon as it arrives.
   */
  timeZone?: string;
  startQtrYYYYQ?: string;
  endQtrYYYYQ?: string;
  /**
   * Background refresh timing in seconds (issue #281), from ADMIN_REFRESH_SEC,
   * ADMIN_REFRESH_JITTER, NON_ADMIN_REFRESH and NON_ADMIN_JITTER. A wait is uniform between
   * base - jitter and base + jitter. See utils/refreshInterval.
   */
  adminRefreshSec?: number;
  adminRefreshJitter?: number;
  nonAdminRefresh?: number;
  nonAdminJitter?: number;
}

export function useSystemInfo() {
  return useQuery<SystemInfo>({
    queryKey: ["systemInfo"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/systemInfo");
        // The one place the frontend learns the app's zone (issue #513); every formatter follows.
        setAppTimeZone(response.data?.timeZone);
        return response.data;
      } catch (e) {
        console.error("Error fetching systemInfo:", e);
        return {
          springH2ConsoleEnabled: false,
          showSwaggerUILink: false,
          oauthLogin: "/oauth2/authorization/google",
          sourceRepo: "",
        };
      }
    },
    initialData: {
      springH2ConsoleEnabled: false,
      showSwaggerUILink: false,
      oauthLogin: "/oauth2/authorization/google",
      sourceRepo: "",
    },
  });
}
