import { useState } from "react";

/**
 * Whether a collapsible card is open, remembered in localStorage under the given key so the card
 * stays as the user left it the next time the page is shown. Until the user has toggled it, the
 * card is open or closed as `defaultOpen` says. Returns the state and a function that flips it.
 */
export function useRememberedOpen(
  key: string,
  defaultOpen: boolean,
): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultOpen : stored === "open";
  });

  const toggle = () => {
    const next = !open;
    localStorage.setItem(key, next ? "open" : "closed");
    setOpen(next);
  };

  return [open, toggle];
}
