import * as React from "react";
import { tokens } from "../theme/tokens";
import { fetchThreadNote, saveThreadNote } from "../services/basicService";

interface ThreadNotePanelProps {
  conversationId: string;
}

const ThreadNotePanel: React.FC<ThreadNotePanelProps> = ({ conversationId }) => {
  const [text, setText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  /* Load note whenever the conversation changes */
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setText("");
    setSaved(false);
    fetchThreadNote(conversationId).then((noteText) => {
      if (!cancelled) {
        setText(noteText);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  /* Auto-save with 450ms debounce */
  React.useEffect(() => {
    if (isLoading) return () => {};
    const timer = setTimeout(() => {
      saveThreadNote(conversationId, text).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryColor = tokens.colors.primary;

  return (
    <div
      style={{
        margin: `0 ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
        border: `1px solid ${primaryColor}`,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.colors.surface,
        overflow: "hidden",
        flexShrink: 0,
        height: "28vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
          borderBottom: `1px solid ${tokens.colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: tokens.colors.background,
        }}
      >
        <span
          style={{
            fontSize: tokens.font.caption.size,
            color: primaryColor,
            fontWeight: tokens.font.label.weight,
            letterSpacing: "0.02em",
          }}
        >
          Thread Notes
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing.sm }}>
          {saved && (
            <span style={{ fontSize: tokens.font.caption.size, color: "#107C41" }}>
              Saved ✓
            </span>
          )}
          {text && (
            <button
              onClick={() => setText("")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: tokens.font.caption.size,
                color: tokens.colors.textSecondary,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={isLoading ? "" : text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
        placeholder={isLoading ? "Loading..." : "Add notes about this email thread..."}
        style={{
          flex: 1,
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          padding: `${tokens.spacing.md}px`,
          border: "none",
          outline: "none",
          resize: "none",
          fontFamily: "inherit",
          fontSize: tokens.font.body.size,
          lineHeight: 1.6,
          color: isLoading ? tokens.colors.placeholder : tokens.colors.text,
          background: "transparent",
          overflowY: "auto",
        }}
      />
    </div>
  );
};

export default ThreadNotePanel;
