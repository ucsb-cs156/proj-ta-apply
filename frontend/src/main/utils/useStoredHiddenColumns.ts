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
 * An opt-in column (issue #447 review: the ranking page's Comments) is hidden until the user shows
 * it, even for a user whose list was stored before the column existed. Which opt-in columns the
 * user has shown is kept apart from the hidden list, under the key plus ".shown", so the stored
 * lists of the other columns keep their meaning.
 *
 * @param storageKey where the list is kept, per browser
 * @param defaultHidden the ids hidden until the user chooses otherwise
 * @param optInColumns the ids hidden until the user shows them
 */
export function useStoredHiddenColumns(
  storageKey: string,
  defaultHidden: string[],
  // Stryker disable next-line ArrayDeclaration : no table has a column called "Stryker was here"
  optInColumns: string[] = [],
): {
  hiddenColumns: string[];
  toggleColumn: (columnId: string, hidden: boolean) => void;
} {
  const shownKey = `${storageKey}.shown`;
  const [stored, setStored] = useState<string[] | null>(() =>
    readStored(storageKey),
  );
  const [shown, setShown] = useState<string[] | null>(() =>
    readStored(shownKey),
  );
  // Written after the render that holds the change, never on the first one, so merely opening
  // the page stores nothing.
  useEffect(() => {
    if (stored !== null) {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    }
  }, [storageKey, stored]);
  useEffect(() => {
    if (shown !== null) {
      localStorage.setItem(shownKey, JSON.stringify(shown));
    }
  }, [shownKey, shown]);

  const shownOptIn = shown ?? [];
  return {
    hiddenColumns: [
      ...(stored ?? defaultHidden).filter((id) => !optInColumns.includes(id)),
      ...optInColumns.filter((id) => !shownOptIn.includes(id)),
    ],
    // A function update, since "Show All" and "Show None" toggle one column after another
    // within the same event.
    toggleColumn: (columnId, hidden) => {
      const update = (current: string[], add: boolean) => {
        const without = current.filter((id) => id !== columnId);
        return add ? [...without, columnId] : without;
      };
      if (optInColumns.includes(columnId)) {
        setShown((previous) => update(previous ?? [], !hidden));
      } else {
        setStored((previous) => update(previous ?? defaultHidden, hidden));
      }
    },
  };
}
