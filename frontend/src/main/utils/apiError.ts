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

/**
 * Whether a failed request is worth a toast (issue #198). It is not when the backend could not be
 * reached at all (no response: the server is restarting or the network is down) or when it
 * answered 401 or 403, which after a restart means the session is gone and the user is about to
 * see the sign-in screen anyway. Every other failure (a 400 the user can act on, a 404, a 500) is
 * a real problem and still gets its toast. Suppressed errors are still logged to the console.
 */
export function shouldToastBackendError(error: unknown): boolean {
  const response = (error as { response?: { status?: number } } | null)
    ?.response;
  if (response === undefined || response === null) {
    return false;
  }
  return response.status !== 401 && response.status !== 403;
}
