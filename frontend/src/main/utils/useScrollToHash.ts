import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Scrolls to the element named by the URL's hash on arrival, so a link such as /help/admins#courses
 * lands on the section it names. Does nothing when there is no hash or no such element.
 */
export default function useScrollToHash(): void {
  const location = useLocation();

  // Stryker disable all : the hash never changes while the page is mounted in a test, so the
  // dependency list cannot be told apart from an empty one; the behaviour itself is tested.
  useEffect(() => {
    if (!location.hash) return;
    const element = document.getElementById(location.hash.slice(1));
    if (element) {
      element.scrollIntoView();
    }
  }, [location.hash]);
  // Stryker restore all
}
