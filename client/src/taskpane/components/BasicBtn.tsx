import * as React from "react";
import { Button, makeStyles } from "@fluentui/react-components";
import { useGenerateReply } from "../hooks/useBasicService";
import { useTheme } from "./ThemeContext";
import { getEmailContext } from "../taskpane";

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
});

const BasicBtn: React.FC<BasicBtnProps> = (props: BasicBtnProps) => {
  const { mutate, isPending } = useGenerateReply();
  const styles = useStyles();
  const { isDark } = useTheme();

  const handleGenerateReply = async () => {
    try {
      const context = await getEmailContext();
      mutate(context, {
        onSuccess: (reply) => {
          props.insertText(reply);
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

  const cardBg = isDark ? "#2a2a3e" : "#FFFFFF";
  const textColor = isDark ? "#e0e0e0" : "#000";

  return (
    <div className={styles.card} style={{ backgroundColor: cardBg }}>
      <p className={styles.label} style={{ color: textColor }}>Generate AI reply from email thread</p>
      <Button className={styles.button} appearance="primary" disabled={isPending} size="medium" onClick={handleGenerateReply}>
        {isPending ? "Generating..." : "Generate reply"}
      </Button>
    </div>
  );
};

export default BasicBtn;
