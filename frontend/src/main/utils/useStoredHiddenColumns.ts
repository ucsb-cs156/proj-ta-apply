import { useEffect, useState } from "react";

/** What is in local storage under the key: a list of column ids, or null when there is none. */
const readStored = (storageKey: string): string[] | null => {
  try {
    // Stryker disable next-line StringLiteral : any text that is not JSON throws, the same as ""
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "");
    return Array.isArray(parsed) &&
      parsed.every((id): id is string => typeof id === "string")
      ? parsed
      : null;
  } catch {
    // Nothing stored, or something that is not JSON: start from the defaults.
    return null;
  }
};

/**
 * Which columns of a table the user has hidden, remembered in the browser's local storage (issue
 * #300), and how to hide or show one. Until the user changes something the defaults apply; the
 * first change stores the whole list, so a later change to the defaults does not move a column the
 * user has already chosen.
 *
 * @param storageKey where the list is kept, per browser
 * @param defaultHidden the ids hidden until the user chooses otherwise
 */
export function useStoredHiddenColumns(
  storageKey: string,
  defaultHidden: string[],
): {
  hiddenColumns: string[];
  toggleColumn: (columnId: string, hidden: boolean) => void;
} {
  const [stored, setStored] = useState<string[] | null>(() =>
    readStored(storageKey),
  );
  // Written after the render that holds the change, never on the first one, so merely opening
  // the page stores nothing.
  useEffect(() => {
    if (stored !== null) {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    }
  }, [storageKey, stored]);

  return {
    hiddenColumns: stored ?? defaultHidden,
    // A function update, since "Select All" and "Select None" toggle one column after another
    // within the same event.
    toggleColumn: (columnId, hidden) =>
      setStored((previous) => {
        const current = previous ?? defaultHidden;
        const without = current.filter((id) => id !== columnId);
        return hidden ? [...without, columnId] : without;
      }),
  };
}
