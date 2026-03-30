import * as React from "react";
import { tokens } from "../theme/tokens";

interface DraftBoxProps {
  content: string;
  isStreaming: boolean;
  onInsert: () => void;
  onDiscard: () => void;
  onEdit: (content: string) => void;
  onImport?: () => void;
}

const DraftBox: React.FC<DraftBoxProps> = ({ content, isStreaming, onInsert, onDiscard, onEdit, onImport }) => {
  return (
    <div
      style={{
        margin: `0 ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
        border: `1px solid ${tokens.colors.primary}`,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.colors.surface,
        overflow: "hidden",
        flexShrink: 0,
        height: "40vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
            color: tokens.colors.primary,
            fontWeight: tokens.font.label.weight,
            letterSpacing: "0.02em",
          }}
        >
          Draft Reply
        </span>
        {isStreaming && (
          <span style={{ fontSize: tokens.font.caption.size, color: tokens.colors.textSecondary }}>
            Generating...
          </span>
        )}
        {!isStreaming && content === "" && onImport && (
          <button
            onClick={onImport}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: tokens.font.caption.size,
              color: tokens.colors.primary,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Import from compose
          </button>
        )}
      </div>

      <textarea
        value={content}
        onChange={(e) => onEdit(e.target.value)}
        disabled={isStreaming}
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
          color: isStreaming ? tokens.colors.textSecondary : tokens.colors.text,
          background: "transparent",
          overflowY: "auto",
        }}
      />

      {!isStreaming && (
        <div
          style={{
            padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
            borderTop: `1px solid ${tokens.colors.border}`,
            display: "flex",
            gap: tokens.spacing.sm,
            backgroundColor: tokens.colors.background,
          }}
        >
          <button
            onClick={onInsert}
            style={{
              backgroundColor: tokens.colors.primary,
              color: "#fff",
              border: "none",
              borderRadius: tokens.radius.sm,
              padding: `3px ${tokens.spacing.md}px`,
              fontSize: tokens.font.label.size,
              fontWeight: tokens.font.label.weight,
              cursor: "pointer",
            }}
          >
            Insert reply
          </button>
          <button
            onClick={onDiscard}
            style={{
              backgroundColor: "transparent",
              color: tokens.colors.textSecondary,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.sm,
              padding: `3px ${tokens.spacing.md}px`,
              fontSize: tokens.font.label.size,
              fontWeight: tokens.font.label.weight,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
};

export default DraftBox;
