import * as React from "react";
import { Button, Field, tokens, makeStyles } from "@fluentui/react-components";
import { useBasicService } from "../hooks/useBasicService";

interface BasicBtnProps {
  insertText: (text: string) => void;
}

const useStyles = makeStyles({
  instructions: {
    fontWeight: tokens.fontWeightSemibold,
    marginTop: "20px",
    marginBottom: "10px",
  },
  textPromptAndInsertion: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  textAreaField: {
    marginLeft: "20px",
    marginTop: "30px",
    marginBottom: "20px",
    marginRight: "20px",
    maxWidth: "50%",
  },
});

const BasicBtn: React.FC<BasicBtnProps> = (props: BasicBtnProps) => {
  const { mutate, isPending } = useBasicService();

  const handleTextInsertion = () => {
    mutate(undefined, {
      onSuccess: (textToInsert) => {
        props.insertText(textToInsert);
      },
      onError: (error) => {
        console.error("Failed to fetch data:", error);
        // Show error to user
        alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      },
    });
  };

  const styles = useStyles();

  return (
    <div className={styles.textPromptAndInsertion}>

      <Field className={styles.instructions}>Click the button to fetch from server and put into email body</Field>
      <Button appearance="primary" disabled={isPending} size="large" onClick={handleTextInsertion}>
        {isPending ? "Loading..." : "Insert text"}
      </Button>
    </div>
  );
};

export default BasicBtn;
