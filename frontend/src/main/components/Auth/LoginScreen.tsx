import { useSystemInfo } from "../../utils/systemInfo";

export default function LoginScreen({ onLogin }: { onLogin?: () => void }) {
  const { data: systemInfo } = useSystemInfo();

  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    }
    window.location.href =
      systemInfo?.oauthLogin ?? "/oauth2/authorization/google";
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0ca6e9",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          borderTop: "1.5px solid #1E293B",
          borderLeft: "1.5px solid #1E293B",
          borderRight: "4px solid #1E293B",
          borderBottom: "4px solid #1E293B",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "40px 48px",
          width: 360,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontFamily: "Helvetica, Arial, sans-serif",
            fontWeight: 800,
            fontSize: 30,
            color: "#1E293B",
            background: "#d9f9ff",
            padding: "10px 14px",
            borderRadius: 8,
            borderTop: "1.5px solid #1E293B",
            borderLeft: "1.5px solid #1E293B",
            borderRight: "4px solid #1E293B",
            borderBottom: "4px solid #1E293B",
          }}
        >
          Welcome to TA Apply
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#64748B",
            marginBottom: 28,
            marginTop: 20,
          }}
        >
          Sign in to continue.
        </div>
        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "10px 0",
            fontSize: 14,
            fontWeight: 600,
            background: "#1E293B",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Log In with Google
        </button>
      </div>
    </div>
  );
}
