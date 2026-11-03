import { formatPacificDateTime } from "main/utils/pacificTime";

/**
 * Format a timestamp into a human-readable date and time, in Pacific time (issue #293)
 * @param {string | null | undefined} timestamp - ISO format timestamp string, with or without a zone; blank when missing
 * @returns {string} - Formatted date and time string
 */
export function formatTime(timestamp) {
  return formatPacificDateTime(timestamp);
}
