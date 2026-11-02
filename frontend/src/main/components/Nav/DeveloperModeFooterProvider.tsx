import { createContext, useContext, useState, type ReactNode } from "react";
import {
  DeveloperModeFooterControlsContext,
  DeveloperModeFooterSetterContext,
} from "main/utils/developerModeFooter";

/** True below a provider, so a second one further down can step aside. */
const ProviderPresentContext = createContext(false);

/**
 * Holds the controls a page has registered for the footer's developer-mode slot (issue #217).
 *
 * App wraps every route in one, so any page may call useDeveloperModeFooterControls directly: the
 * page sits below the provider, and so does the footer that BasicLayout renders. BasicLayout also
 * renders one, as a fallback for pages mounted without App (tests and stories); where a provider
 * already exists above it, that one steps aside, so the page and the footer always share the same
 * slot. The setter comes from useState, so it is stable and registering pages never re-render
 * because of the slot.
 */
export default function DeveloperModeFooterProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const alreadyProvided = useContext(ProviderPresentContext);
  const [controls, setControls] = useState<ReactNode>(null);
  if (alreadyProvided) {
    return <>{children}</>;
  }
  return (
    <ProviderPresentContext.Provider value={true}>
      <DeveloperModeFooterSetterContext.Provider value={setControls}>
        <DeveloperModeFooterControlsContext.Provider value={controls}>
          {children}
        </DeveloperModeFooterControlsContext.Provider>
      </DeveloperModeFooterSetterContext.Provider>
    </ProviderPresentContext.Provider>
  );
}
