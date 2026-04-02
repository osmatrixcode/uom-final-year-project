import * as React from "react";
import { tokens } from "../theme/tokens";

export interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const [showHelp, setShowHelp] = React.useState(false);

  return (
    <div
      style={{
        width: "100%",
        padding: `${tokens.spacing.lg}px ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          style={{
            fontSize: tokens.font.title.size,
            fontWeight: tokens.font.title.weight,
            color: tokens.colors.text,
            margin: 0,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        <button
          onClick={() => setShowHelp((prev) => !prev)}
          aria-label="Help"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "none",
            background: tokens.colors.primary,
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ?
        </button>
      </div>

      {showHelp && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: tokens.spacing.lg,
            right: tokens.spacing.lg,
            background: tokens.colors.primary,
            color: "#fff",
            borderRadius: tokens.radius.md,
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.font.body.size,
            lineHeight: 1.5,
            zIndex: 100,
            boxShadow: tokens.shadow.cardHover,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: tokens.spacing.xs }}>
            <strong>Help</strong>
            <button
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "16px",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: `0 0 ${tokens.spacing.xs}px` }}>
            <strong>General Q&amp;A</strong> — Ask questions about the email thread.
          </p>
          <p style={{ margin: `0 0 ${tokens.spacing.xs}px` }}>
            <strong>Email Draft</strong> — Generate or refine a reply draft, then insert it.
          </p>
          <p style={{ margin: `0 0 ${tokens.spacing.xs}px` }}>
            <strong>Sender Edit</strong> — Manage per-sender tone profiles and thread notes.
          </p>
          <p style={{ margin: 0 }}>
            Press <strong>Ctrl+/</strong> to switch between modes.
          </p>
        </div>
      )}
    </div>
  );
};

export default Header;
