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
        style={{
          width: "1126px",
          maxWidth: "100%",
          margin: "0 auto",
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
          <Link to="/about">About TA Apply</Link>
        </span>
      </div>
    </footer>
  );
}
