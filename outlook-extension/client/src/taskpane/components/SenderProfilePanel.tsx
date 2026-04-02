import * as React from "react";
import { tokens } from "../theme/tokens";
import { EmailRecipient } from "../taskpane";
import { fetchProfile, saveProfile, generateProfile } from "../services/basicService";
import { getEmailContext } from "../taskpane";

export interface SenderProfilePanelHandle {
  save: () => Promise<void>;
  getText: () => string;
  setText: (text: string) => void;
  markSaved: (text: string) => void;
}

interface SenderProfilePanelProps {
  sender: EmailRecipient;
  onDirtyChange?: (dirty: boolean) => void;
  onError?: (msg: string) => void;
  onFocus?: () => void;
}

const SenderProfilePanel = React.forwardRef<SenderProfilePanelHandle, SenderProfilePanelProps>(
  ({ sender, onDirtyChange, onFocus, onError }, ref) => {
  const [text, setText] = React.useState("");
  const [savedText, setSavedText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const isDirty = !isLoading && text !== savedText;

  /* Notify parent of dirty state changes */
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load profile whenever the selected sender changes */
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setText("");
    setSavedText("");
    fetchProfile(sender.emailAddress).then((profileText) => {
      if (!cancelled) {
        setText(profileText);
        setSavedText(profileText);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [sender.emailAddress]);

  /* Expose save/getText/setText to parent via ref */
  React.useImperativeHandle(ref, () => ({
    save: async () => {
      await saveProfile(sender.emailAddress, text);
      setSavedText(text);
    },
    getText: () => text,
    setText: (newText: string) => setText(newText),
    markSaved: (val: string) => setSavedText(val),
  }), [sender.emailAddress, text]);

  const handleAutoFill = async () => {
    setIsGenerating(true);
    try {
      const ctx = await getEmailContext();
      const generated = await generateProfile(sender.emailAddress, ctx.subject, ctx.body);
      setText(generated);
      setSavedText(generated); // server auto-saved after generate
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Auto-fill failed. Please try again.";
      onError?.(msg);
    }
    setIsGenerating(false);
  };

  const accentColor = tokens.colors.accent;

  return (
    <div
      style={{
        margin: `0 ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
        border: `1px solid ${accentColor}`,
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
        <div style={{ overflow: "hidden" }}>
          <span
            style={{
              fontSize: tokens.font.caption.size,
              color: accentColor,
              fontWeight: tokens.font.label.weight,
              letterSpacing: "0.02em",
            }}
          >
            {sender.displayName || sender.emailAddress}
          </span>
          {sender.displayName && (
            <span
              style={{
                fontSize: tokens.font.caption.size,
                color: tokens.colors.placeholder,
                marginLeft: tokens.spacing.sm,
              }}
            >
              {sender.emailAddress}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing.sm, flexShrink: 0 }}>
          {isDirty && (
            <span style={{ fontSize: tokens.font.caption.size, color: tokens.colors.accent }}>
              Unsaved
            </span>
          )}
          {!text && !isLoading && (
            <button
              onClick={handleAutoFill}
              disabled={isGenerating}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: tokens.font.caption.size,
                color: isGenerating ? tokens.colors.placeholder : accentColor,
                cursor: isGenerating ? "wait" : "pointer",
                fontWeight: tokens.font.label.weight,
              }}
            >
              {isGenerating ? "Generating..." : "Auto-fill"}
            </button>
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
        onFocus={onFocus}
        disabled={isLoading}
        placeholder={isLoading ? "Loading..." : "Add notes about this sender (tone, preferences, context)..."}
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
});

export default SenderProfilePanel;
