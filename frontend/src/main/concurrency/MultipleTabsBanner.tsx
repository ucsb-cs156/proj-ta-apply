import { RISK_SENTENCE, describeOthers, type OtherClient } from "./others";

type MultipleTabsBannerProps = {
  /** Who else is working on the same thing, as the server last said; nothing is shown if no one. */
  others: OtherClient[];
  /** What is open twice, as it should read in the sentence: "application", "budget". */
  noun: string;
  testId?: string;
  /**
   * Whether assistive technology should announce it when it appears. True for the live warning;
   * false for a picture of it in the Help, which is not a warning about anything.
   */
  announce?: boolean;
};

/**
 * The warning shown while the server says another tab or window is working on the same thing
 * (issue #273): who they are, then that it is risky. It is advice, so it has no buttons. The names
 * are shown as text, which React escapes, never as markup. Plain Bootstrap classes, so that nothing
 * but React is needed.
 */
export default function MultipleTabsBanner({
  others,
  noun,
  testId = "MultipleTabsBanner",
  announce = true,
}: MultipleTabsBannerProps): React.JSX.Element | null {
  if (others.length === 0) {
    return null;
  }
  return (
    <div
      className="alert alert-warning"
      role={announce ? "alert" : undefined}
      // A long name wraps instead of pushing the page wider.
      style={{ overflowWrap: "anywhere" }}
      data-testid={testId}
    >
      {describeOthers(others, noun)} {RISK_SENTENCE}
    </div>
  );
}
