import * as React from "react";
import { tokens } from "../theme/tokens";
import { ShimmerButton } from "./ShimmerButton";

/* global HTMLTextAreaElement */

export type InputMode = "general_qa" | "email_draft" | "sender_edit";

const MODE_LABELS: Record<InputMode, string> = {
  general_qa: "General QA",
  email_draft: "Email Draft",
  sender_edit: "Sender Edit",
};

const MODE_BORDER_COLORS: Record<InputMode, string> = {
  general_qa: tokens.colors.border,
  email_draft: tokens.colors.primary,
  sender_edit: tokens.colors.accent,
};

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onModeSwitch: () => void;
  mode: InputMode;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onModeSwitch,
  mode,
  disabled = false,
  placeholder = "How can I help?",
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      onModeSwitch();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  const borderColor = MODE_BORDER_COLORS[mode];

  return (
    <div
      style={{
        backgroundColor: tokens.colors.surface,
        borderTop: `1px solid ${tokens.colors.border}`,
        padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px ${tokens.spacing.md}px`,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: tokens.spacing.xs,
          paddingLeft: 2,
        }}
      >
        <span
          style={{
            fontSize: tokens.font.caption.size,
            color: borderColor,
            fontWeight: tokens.font.label.weight,
            letterSpacing: "0.02em",
            transition: "color 0.15s ease",
          }}
        >
          {MODE_LABELS[mode]}
        </span>
        <span
          style={{
            fontSize: tokens.font.caption.size,
            color: tokens.colors.placeholder,
          }}
        >
          ⇧Tab to switch
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: tokens.spacing.sm,
          backgroundColor: tokens.colors.background,
          borderRadius: tokens.radius.lg,
          padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
          border: `1px solid ${borderColor}`,
          boxShadow: tokens.shadow.input,
          transition: "border-color 0.15s ease",
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontSize: tokens.font.body.size,
            lineHeight: 1.4,
            padding: 0,
            fontFamily: "inherit",
            color: disabled ? tokens.colors.textSecondary : tokens.colors.text,
          }}
        />
        <ShimmerButton
          background={tokens.colors.accent}
          shimmerColor="#fff"
          shimmerDuration="2.5s"
          borderRadius={tokens.radius.pill}
          disabled={disabled || !value.trim()}
          onClick={onSend}
          style={{
            padding: "5px 12px",
            fontSize: tokens.font.label.size,
            fontWeight: tokens.font.label.weight,
            flexShrink: 0,
            opacity: disabled || !value.trim() ? 0.5 : 1,
            cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          }}
        >
          {disabled ? "···" : "↑"}
        </ShimmerButton>
      </div>
    </div>
  );
};

export default ChatInput;
