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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: tokens.spacing.xs,
            }}
          >
            <strong style={{ textDecoration: "underline" }}>Help</strong>
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
          <p style={{ margin: `0 0 ${tokens.spacing.sm}px` }}>
            <strong>General QA Mode: </strong>
            Ask questions about the current email thread. Useful for summarising lengthy
            conversations, clarifying context, or extracting key details before you reply.
          </p>
          <p style={{ margin: `0 0 ${tokens.spacing.sm}px` }}>
            <strong>Email Draft Mode: </strong>
            Generate a full reply draft based on your instructions. You can refine the draft
            iteratively, edit it manually, and insert the final version directly into your compose
            window.
          </p>
          <p style={{ margin: `0 0 ${tokens.spacing.sm}px` }}>
            <strong>Sender Edit Mode: </strong>
            Set up tone profiles for individual senders and for specific threads. These tell the AI
            how you prefer to write when replying to a particular person or within a particular
            conversation. If both a sender profile and a thread profile exist, the thread profile
            takes priority. You can edit or remove either at any time. Note: changes in this mode
            may take longer as they are validated by AI and saved to a server.
          </p>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.3)", margin: `${tokens.spacing.sm}px 0` }} />

          <p style={{ margin: `0 0 ${tokens.spacing.sm}px` }}>
            Switch between modes by pressing <strong>Ctrl</strong> and <strong>/</strong> together
            while focused on the input box.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: tokens.font.caption.size,
              opacity: 0.85,
              lineHeight: 1.4,
            }}
          >
            Security: Every submission is automatically checked for prompt injection and other
            threats before it reaches the AI. Sensitive information such as names and emails is
            anonymised during processing. Your data is handled safely at every step.
          </p>
        </div>
      )}
    </div>
  );
};

export default Header;
