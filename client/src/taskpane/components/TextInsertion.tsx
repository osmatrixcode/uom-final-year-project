import * as React from "react";
import { useState } from "react";
import { Button, Textarea, makeStyles } from "@fluentui/react-components";
import { useTheme } from "./ThemeContext";

/* global HTMLTextAreaElement */

interface TextInsertionProps {
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
  textarea: {
    width: "100%",
    minHeight: "80px",
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

const TextInsertion: React.FC<TextInsertionProps> = (props: TextInsertionProps) => {
  const [text, setText] = useState<string>("Some text.");
  const styles = useStyles();
  const { isDark } = useTheme();

  const handleTextInsertion = async () => {
    await props.insertText(text);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const cardBg = isDark ? "#2a2a3e" : "#FFFFFF";
  const textColor = isDark ? "#e0e0e0" : "#000";

  return (
    <div className={styles.card} style={{ backgroundColor: cardBg }}>
      <p className={styles.label} style={{ color: textColor }}>Enter text to insert into the email</p>
      <Textarea className={styles.textarea} size="large" value={text} onChange={handleTextChange} />
      <Button className={styles.button} appearance="primary" size="medium" onClick={handleTextInsertion}>
        Insert text
      </Button>
    </div>
  );
};

export default TextInsertion;
