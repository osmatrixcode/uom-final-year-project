import * as React from "react";
import { tokens } from "../theme/tokens";

const CURSOR_STYLE_ID = "streaming-cursor-style";
function injectCursorStyle() {
  if (typeof document === "undefined" || document.getElementById(CURSOR_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = CURSOR_STYLE_ID;
  s.textContent = `@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}.streaming-cursor{display:inline-block;width:2px;height:0.9em;background:currentColor;vertical-align:text-bottom;margin-left:1px;animation:blink 0.9s step-start infinite;}`;
  document.head.appendChild(s);
}

export type MessageMode = "general_qa" | "email_draft" | "sender_edit";

const MODE_BUBBLE_COLOR: Record<MessageMode, string> = {
  general_qa: "#107C41",
  email_draft: "#0062AD",
  sender_edit: "#C4622D",
};

export interface Message {
  role: "user" | "ai";
  content: string;
  isDraft?: boolean;
  isStreaming?: boolean;
  mode?: MessageMode;
}

interface MessageBubbleProps {
  message: Message;
  onInsert?: (text: string) => void;
  onDiscard?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onInsert, onDiscard }) => {
  React.useEffect(() => { injectCursorStyle(); }, []);
  const isUser = message.role === "user";

  if (isUser) {
    const bubbleColor = message.mode ? MODE_BUBBLE_COLOR[message.mode] : tokens.colors.userBubble;
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: tokens.spacing.sm }}>
        <div
          style={{
            backgroundColor: bubbleColor,
            color: "#fff",
            borderRadius: `${tokens.radius.md} ${tokens.radius.md} 3px ${tokens.radius.md}`,
            padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
            maxWidth: "85%",
            fontSize: tokens.font.body.size,
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xs, marginBottom: tokens.spacing.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing.xs }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: tokens.colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontSize: "8px", fontWeight: 700 }}>AI</span>
        </div>
        <span style={{ fontSize: tokens.font.caption.size, color: tokens.colors.textSecondary, fontWeight: 600 }}>
          Assistant
        </span>
      </div>

      <div
        style={{
          color: tokens.colors.text,
          fontSize: tokens.font.body.size,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          marginLeft: tokens.spacing.xl + tokens.spacing.xs,
          padding: `0 ${tokens.spacing.xs}px`,
        }}
      >
        {message.content}
        {message.isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>

      {message.isDraft && (
        <div style={{ display: "flex", gap: tokens.spacing.sm, marginLeft: tokens.spacing.xl + tokens.spacing.xs }}>
          <button
            onClick={() => onInsert?.(message.content)}
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

export default MessageBubble;
