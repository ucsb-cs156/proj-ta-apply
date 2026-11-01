import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * The footer's developer-mode slot (issue #217): the controls a page has registered to appear to
 * the right of the Developer Mode badge. Two contexts, so that a page registering controls does
 * not itself re-render when the slot's contents change (which would re-register and loop): the
 * footer reads the controls context; registering pages use only the stable setter context. The
 * provider lives in BasicLayout.
 */
export type SetDeveloperModeFooterControls = (controls: ReactNode) => void;

export const DeveloperModeFooterControlsContext =
  createContext<ReactNode>(null);

export const DeveloperModeFooterSetterContext =
  createContext<SetDeveloperModeFooterControls>(() => {});

/** What the footer reads: the controls registered by the current page, or null. */
export const useDeveloperModeFooterControlsValue = (): ReactNode =>
  useContext(DeveloperModeFooterControlsContext);

/**
 * Registers page-specific developer-mode controls in the footer for as long as the calling
 * component is mounted, and clears them when it unmounts. Pages render their controls through
 * this rather than editing the footer. The footer shows them only while developer mode is on.
 */
export function useDeveloperModeFooterControls(controls: ReactNode): void {
  const setControls = useContext(DeveloperModeFooterSetterContext);
  useEffect(() => {
    setControls(controls);
    return () => setControls(null);
  }, [controls, setControls]);
}
