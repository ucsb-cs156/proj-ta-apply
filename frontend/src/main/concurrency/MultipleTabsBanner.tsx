type MultipleTabsBannerProps = {
  /** What is open twice, as it should read in the sentence: "application", "budget". */
  noun: string;
  testId?: string;
};

/**
 * The warning shown while the server says more than one tab or window is working on the same
 * thing (issue #273). It is advice, so it has no buttons. Plain Bootstrap classes, so that nothing
 * but React is needed.
 */
export default function MultipleTabsBanner({
  noun,
  testId = "MultipleTabsBanner",
}: MultipleTabsBannerProps): React.JSX.Element {
  return (
    <div className="alert alert-warning" role="alert" data-testid={testId}>
      The server has detected multiple tabs or windows open on the same {noun}.
      Please know that this is risky; we recommend closing all but one of these.
    </div>
  );
}
