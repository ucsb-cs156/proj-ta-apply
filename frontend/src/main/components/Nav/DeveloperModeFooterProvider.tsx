import { useState, type ReactNode } from "react";
import {
  DeveloperModeFooterControlsContext,
  DeveloperModeFooterSetterContext,
} from "main/utils/developerModeFooter";

/**
 * Holds the controls a page has registered for the footer's developer-mode slot (issue #217).
 * Rendered once by BasicLayout around the page and its footer. The setter comes from useState, so
 * it is stable and registering pages never re-render because of the slot.
 */
export default function DeveloperModeFooterProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [controls, setControls] = useState<ReactNode>(null);
  return (
    <DeveloperModeFooterSetterContext.Provider value={setControls}>
      <DeveloperModeFooterControlsContext.Provider value={controls}>
        {children}
      </DeveloperModeFooterControlsContext.Provider>
    </DeveloperModeFooterSetterContext.Provider>
  );
}
