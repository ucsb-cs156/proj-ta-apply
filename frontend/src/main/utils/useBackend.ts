import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import axios, { type AxiosRequestConfig } from "axios";
import { toast } from "react-toastify";

// example
//  queryKey ["/api/users/all"] for "api/users/all"
//  queryKey ["/api/users","4"]  for "/api/users?id=4"

// For axiosParameters
//
// {
//     method: 'post',
//     url: '/user/12345',
//     data: {
//       firstName: 'Fred',
//       lastName: 'Flintstone'
//     }
//  }
//

// GET Example:
// useBackend(
//     ["/api/admin/users"],
//     { method: "GET", url: "/api/admin/users" },
//     []
// );

export function useBackend<T>(
  queryKey: unknown[],
  axiosParameters: AxiosRequestConfig,
  initialData: T,
  suppressToasts = false,
  options: Partial<UseQueryOptions<T>> = {},
) {
  return useQuery<T>({
    queryKey: queryKey,
    queryFn: async () => {
      try {
        const response = await axios(axiosParameters);
        return response.data;
      } catch (e) {
        const errorMessage = `Error communicating with backend via ${axiosParameters.method} on ${axiosParameters.url}`;
        if (!suppressToasts) {
          toast(errorMessage);
        }
        console.error(errorMessage, e);
        throw e;
      }
    },
    initialData: initialData,
    ...options,
  });
}

const wrappedParams = async <TData>(params: AxiosRequestConfig) => {
  // Directly returning the promise allows useMutation to handle rejections.
  const response = await axios(params);
  return response.data as TData;
};

export function useBackendMutation<TInput, TData = unknown>(
  objectToAxiosParams: (object: TInput) => AxiosRequestConfig,
  useMutationParams: Partial<UseMutationOptions<TData, unknown, TInput>>,
  queryKey: string[] | null = null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (object: TInput) =>
      wrappedParams<TData>(objectToAxiosParams(object)),
    onError: (data) => {
      toast(`${data}`);
    },
    // Stryker disable all: Not sure how to set up the complex behavior needed to test this
    onSettled: () => {
      if (queryKey !== null) {
        // Handle array of query keys for cache invalidation
        if (Array.isArray(queryKey)) {
          queryKey.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      }
    },
    // Stryker restore all
    retry: false,
    ...useMutationParams,
  });
}
