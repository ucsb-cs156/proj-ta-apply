/**
 * The warning shown above an admin's preview of the application form. Deliberately loud: the
 * form below it looks exactly like the real one, and the colour is the only thing that says
 * otherwise. Orange is used nowhere else in the app.
 */
export default function TestOnlyBanner(): React.JSX.Element {
  return (
    <div
      role="alert"
      data-testid="TestOnlyBanner"
      className="text-center fw-bold py-2"
      style={{
        backgroundColor: "#ff6f00",
        color: "#ffffff",
        fontSize: "1.25rem",
        letterSpacing: "0.05em",
      }}
    >
      This is a test only
    </div>
  );
}
