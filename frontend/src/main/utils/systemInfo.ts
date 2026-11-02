import { useQuery } from "@tanstack/react-query";
import axios from "axios";

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
