import * as React from "react";
import { useState } from "react";
import { Button, Textarea, makeStyles } from "@fluentui/react-components";

/* global HTMLTextAreaElement */

interface TextInsertionProps {
  insertText: (text: string) => void;
}

const useStyles = makeStyles({
  card: {
    backgroundColor: "#FBF0DC",
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
    color: "#000",
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

  const handleTextInsertion = async () => {
    await props.insertText(text);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  return (
    <div className={styles.card}>
      <p className={styles.label}>Enter text to insert into the email</p>
      <Textarea className={styles.textarea} size="large" value={text} onChange={handleTextChange} />
      <Button className={styles.button} appearance="primary" size="medium" onClick={handleTextInsertion}>
        Insert text
      </Button>
    </div>
  );
};

export default TextInsertion;
