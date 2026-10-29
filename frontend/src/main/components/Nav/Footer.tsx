import { Link } from "react-router";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#ffffff",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        className="content-column"
        style={{
          padding: "16px 20px",
          color: "#475569",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span>
          <Link to="/help/about">About TA Apply</Link>
        </span>
      </div>
    </footer>
  );
}
