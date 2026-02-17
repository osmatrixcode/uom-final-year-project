import * as React from "react";
import { Button, makeStyles } from "@fluentui/react-components";
import { useBasicService } from "../hooks/useBasicService";

interface BasicBtnProps {
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
  const { mutate, isPending } = useBasicService();
  const styles = useStyles();

  const handleTextInsertion = () => {
    mutate(undefined, {
      onSuccess: (textToInsert) => {
        props.insertText(textToInsert);
      },
      onError: (error) => {
        console.error("Failed to fetch data:", error);
        alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      },
    });
  };

  return (
    <div className={styles.card}>
      <p className={styles.label}>Fetch from server and insert into email body</p>
      <Button className={styles.button} appearance="primary" disabled={isPending} size="medium" onClick={handleTextInsertion}>
        {isPending ? "Loading..." : "Fetch & insert"}
      </Button>
    </div>
  );
};

export default BasicBtn;
