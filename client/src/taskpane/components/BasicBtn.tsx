import * as React from "react";
import { Button, Textarea, makeStyles } from "@fluentui/react-components";
import { useGenerateReply } from "../hooks/useBasicService";
import { getEmailContext } from "../taskpane";

/* global HTMLTextAreaElement */

const LOADING_PHRASES = [
  "Herding the cats...",
  "Boiling the ocean...",
  "Circling back with the AI...",
  "Leveraging synergies...",
  "Touching base with GPT...",
  "Thinking outside the inbox...",
  "Picking the low-hanging fruit...",
  "Moving the needle...",
  "Generating enterprise value...",
  "Consulting the reply oracle...",
  "Summoning professional prose...",
  "Banishing filler words...",
  "Running it up the flagpole...",
  "Eating the frog...",
  "Teaching AI to write emails...",
  "Counting tokens...",
  "Spell-checking... twice...",
  "Adding buzzwords... removing buzzwords...",
  "Asking the AI nicely...",
  "Making it sound smart...",
];

interface BasicBtnProps {
  insertText: (text: string) => void;
  defaultSubtitle: string;
  onSubtitleChange: (text: string) => void;
}

const useStyles = makeStyles({
  wrapper: {
    padding: "16px",
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  previewLabel: {
    fontSize: "12px",
    fontWeight: "600",
    margin: "0",
  },
  previewTextarea: {
    width: "100%",
    minHeight: "130px",
  },
  actionRow: {
    display: "flex",
    gap: "8px",
  },
  insertBtn: {
    backgroundColor: "#0062AD",
    color: "#fff",
    ":hover": { backgroundColor: "#004E8A" },
  },
  chatBox: {
    borderRadius: "16px",
    padding: "14px 16px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  chatBottomRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sendBtn: {
    backgroundColor: "#C4622D",
    color: "#fff",
    borderRadius: "10px",
    minWidth: "36px",
    height: "36px",
    padding: "0 10px",
    ":hover": { backgroundColor: "#A5511F" },
  },
});

const BasicBtn: React.FC<BasicBtnProps> = (props: BasicBtnProps) => {
  const { mutate, isPending } = useGenerateReply();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const styles = useStyles();

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPending) {
      const shuffled = [...LOADING_PHRASES].sort(() => Math.random() - 0.5);
      let idx = 0;
      props.onSubtitleChange(shuffled[idx]);
      interval = setInterval(() => {
        idx = (idx + 1) % shuffled.length;
        props.onSubtitleChange(shuffled[idx]);
      }, 1800);
    } else {
      props.onSubtitleChange(props.defaultSubtitle);
    }
    return () => {
      if (interval !== null) clearInterval(interval);
    };
  }, [isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    try {
      const context = await getEmailContext();
      mutate(
        {
          ...context,
          draft: preview ?? undefined,
          instruction: instruction.trim() || undefined,
        },
        {
          onSuccess: (reply) => {
            setPreview(reply);
            setInstruction("");
          },
          onError: (error) => {
            console.error("Failed to generate reply:", error);
            alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
          },
        }
      );
    } catch (error) {
      console.error("Failed to read email context:", error);
      alert(`Error reading email: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsert = () => {
    if (preview !== null) {
      props.insertText(preview);
      setPreview(null);
    }
  };

  const cardBg = "#FFFFFF";
  const previewLabelColor = "#555";
  const chatBg = "#f0f0f0";
  const inputTextColor = "#222";

  const placeholder = preview !== null ? "Refine the draft... (Enter to send)" : "How can I help? (Enter to send)";

  return (
    <div className={styles.wrapper} style={{ backgroundColor: cardBg }}>
      {preview !== null && (
        <>
          <p className={styles.previewLabel} style={{ color: previewLabelColor }}>
            AI reply — edit before inserting
          </p>
          <Textarea
            className={styles.previewTextarea}
            size="large"
            value={preview}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPreview(e.target.value)}
          />
          <div className={styles.actionRow}>
            <Button className={styles.insertBtn} appearance="primary" size="medium" onClick={handleInsert}>
              Insert reply
            </Button>
            <Button appearance="secondary" size="medium" onClick={() => setPreview(null)}>
              Discard
            </Button>
          </div>
        </>
      )}

      <div className={styles.chatBox} style={{ backgroundColor: chatBg, marginTop: "auto" }}>
        <textarea
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontSize: "14px",
            lineHeight: "1.5",
            width: "100%",
            padding: "0",
            fontFamily: "inherit",
            color: inputTextColor,
          }}
          placeholder={placeholder}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isPending}
        />
        <div className={styles.chatBottomRow}>
          <Button
            className={styles.sendBtn}
            appearance="primary"
            disabled={isPending}
            onClick={handleSend}
            >
            {isPending ? "..." : "↑"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BasicBtn;
