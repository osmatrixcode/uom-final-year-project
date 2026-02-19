import * as React from "react";
import { Button, Textarea, makeStyles } from "@fluentui/react-components";
import { useGenerateReply } from "../hooks/useBasicService";
import { useTheme } from "./ThemeContext";
import { getEmailContext } from "../taskpane";

/* global HTMLTextAreaElement */

interface BasicBtnProps {
  insertText: (text: string) => void;
}

const useStyles = makeStyles({
  card: {
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
  },
  label: {
    fontSize: "14px",
    fontWeight: "700",
    margin: "0",
  },
  button: {
    backgroundColor: "#0062AD",
    color: "#fff",
    alignSelf: "flex-start",
    ":hover": {
      backgroundColor: "#004E8A",
    },
  },
  previewSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  previewLabel: {
    fontSize: "13px",
    fontWeight: "600",
    margin: "0",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
  },
  buttonRow: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
    flexWrap: "wrap",
  },
  insertBtn: {
    backgroundColor: "#0062AD",
    color: "#fff",
    ":hover": {
      backgroundColor: "#004E8A",
    },
  },
});

const BasicBtn: React.FC<BasicBtnProps> = (props: BasicBtnProps) => {
  const { mutate, isPending } = useGenerateReply();
  const [preview, setPreview] = React.useState<string | null>(null);
  const styles = useStyles();
  const { isDark } = useTheme();

  const handleGenerateReply = async (draft?: string) => {
    try {
      const context = await getEmailContext();
      mutate({ ...context, draft }, {
        onSuccess: (reply) => {
          setPreview(reply);
        },
        onError: (error) => {
          console.error("Failed to generate reply:", error);
          alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        },
      });
    } catch (error) {
      console.error("Failed to read email context:", error);
      alert(`Error reading email: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleInsert = () => {
    if (preview !== null) {
      props.insertText(preview);
      setPreview(null);
    }
  };

  const cardBg = isDark ? "#2a2a3e" : "#FFFFFF";
  const textColor = isDark ? "#e0e0e0" : "#000";
  const previewLabelColor = isDark ? "#a0a0c0" : "#555";

  return (
    <div className={styles.card} style={{ backgroundColor: cardBg }}>
      <p className={styles.label} style={{ color: textColor }}>Generate AI reply from email thread</p>
      <Button
        className={styles.button}
        appearance="primary"
        disabled={isPending}
        size="medium"
        onClick={() => handleGenerateReply()}
      >
        {isPending ? "Generating..." : "Generate reply"}
      </Button>

      {preview !== null && (
        <div className={styles.previewSection}>
          <p className={styles.previewLabel} style={{ color: previewLabelColor }}>
            AI-generated reply — edit before inserting
          </p>
          <Textarea
            className={styles.textarea}
            size="large"
            value={preview}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPreview(e.target.value)}
          />
          <div className={styles.buttonRow}>
            <Button className={styles.insertBtn} appearance="primary" size="medium" onClick={handleInsert}>
              Insert reply
            </Button>
            <Button appearance="secondary" size="medium" onClick={() => setPreview(null)}>
              Discard
            </Button>
            <Button appearance="subtle" size="medium" disabled={isPending} onClick={() => handleGenerateReply(preview ?? undefined)}>
              {isPending ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BasicBtn;
