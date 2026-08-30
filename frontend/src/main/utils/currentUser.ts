import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router";

// Mirrors the backend User entity (entity/User.java) as serialized in the
// /api/currentUser response. Only id and email are guaranteed by the backend;
// the profile fields may be null for users created before they were added.
export interface User {
  id?: number;
  email: string;
  googleSub?: string | null;
  pictureUrl?: string | null;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

export interface Role {
  authority: string;
}

// Shape of the raw /api/currentUser response (model/CurrentUser.java).
export interface ApiCurrentUser {
  user: User;
  roles: Role[];
}

// The API response plus rolesList, a flattened copy of roles added client-side.
export interface CurrentUserRoot extends ApiCurrentUser {
  rolesList: string[];
}

// Discriminated union: checking loggedIn narrows root, so consumers can use
// currentUser.root.user.email without a cast. When logged out, root is null
// (initialData) or {} (after a 403 from /api/currentUser).
export type CurrentUser =
  | { loggedIn: true; root: CurrentUserRoot }
  | { loggedIn: false; root: Record<string, never> | null };

export function useCurrentUser(): CurrentUser {
  const queryResults = useQuery<CurrentUser>({
    queryKey: ["current user"],
    queryFn: async (): Promise<CurrentUser> => {
      try {
        const response = await axios.get<ApiCurrentUser>("/api/currentUser");
        const rolesList: string[] =
          response.data.roles?.map((r: Role) => r.authority) ?? [];
        return { loggedIn: true, root: { ...response.data, rolesList } };
      } catch (e: unknown) {
        const err = e as { status?: number };
        if (err.status === 403) {
          return { loggedIn: false, root: {} };
        }
        throw e;
      }
    },
    initialData: { loggedIn: false, root: null },
  });
  return queryResults.data;
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await axios.post("/logout");
      await queryClient.resetQueries({ queryKey: ["current user"] });
      navigate("/");
    },
  });
}

export function hasRole(
  currentUser: CurrentUser | null | undefined,
  role: string,
): boolean {
  if (!currentUser?.loggedIn) return false;
  // Optional chaining is defensive: untyped JS callers may pass loggedIn: true
  // with a missing or empty root.
  return currentUser.root?.rolesList?.includes(role) ?? false;
}
