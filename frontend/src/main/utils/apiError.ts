/**
 * What to tell the user when a request fails: the backend's own message when it sent one (its
 * error responses carry a {@code message} field), otherwise the error's text.
 */
export function apiErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;
  if (typeof message === "string" && message !== "") {
    return message;
  }
  return String(error);
}
