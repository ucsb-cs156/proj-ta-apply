import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface SystemInfo {
  springH2ConsoleEnabled: boolean;
  showSwaggerUILink: boolean;
  oauthLogin: string;
  sourceRepo: string;
  commitId?: string;
  commitMessage?: string;
  githubUrl?: string;
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
