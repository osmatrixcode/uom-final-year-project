import * as React from "react";
import { tokens } from "../theme/tokens";
import { fetchThreadNote, saveThreadNote, generateThreadNote as generateThreadNoteApi } from "../services/basicService";
import { getEmailContext } from "../taskpane";

export interface ThreadNotePanelHandle {
  save: () => Promise<void>;
  getText: () => string;
  setText: (text: string) => void;
  markSaved: (text: string) => void;
}

interface ThreadNotePanelProps {
  conversationId: string;
  onDirtyChange?: (dirty: boolean) => void;
  onFocus?: () => void;
  onError?: (msg: string) => void;
}

const ThreadNotePanel = React.forwardRef<ThreadNotePanelHandle, ThreadNotePanelProps>(
  ({ conversationId, onDirtyChange, onFocus, onError }, ref) => {
  const [text, setText] = React.useState("");
  const [savedText, setSavedText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const isDirty = !isLoading && text !== savedText;

  /* Notify parent of dirty state changes */
  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Load note whenever the conversation changes */
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setText("");
    setSavedText("");
    fetchThreadNote(conversationId).then((noteText) => {
      if (!cancelled) {
        setText(noteText);
        setSavedText(noteText);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [conversationId]);

  /* Expose save/getText/setText to parent via ref */
  React.useImperativeHandle(ref, () => ({
    save: async () => {
      await saveThreadNote(conversationId, text);
      setSavedText(text);
    },
    getText: () => text,
    setText: (newText: string) => setText(newText),
    markSaved: (val: string) => setSavedText(val),
  }), [conversationId, text]);

  const handleAutoFill = async () => {
    setIsGenerating(true);
    try {
      const ctx = await getEmailContext();
      const generated = await generateThreadNoteApi(conversationId, ctx.subject, ctx.body);
      setText(generated);
      setSavedText(generated); // server auto-saved after generate
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Auto-fill failed. Please try again.";
      onError?.(msg);
    }
    setIsGenerating(false);
  };

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
                color: isGenerating ? tokens.colors.placeholder : primaryColor,
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
});

export default ThreadNotePanel;
