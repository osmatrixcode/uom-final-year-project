import * as React from "react";
import Header from "./Header";
import { makeStyles } from "@fluentui/react-components";
import { insertText } from "../taskpane";
import BasicBtn from "./BasicBtn";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    boxSizing: "border-box",
    backgroundColor: "#0062AD",
  },
});

const App: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();
  const [subtitle, setSubtitle] = React.useState(props.title);

  return (
    <div className={styles.root}>
      <Header logo="assets/logo-filled.png" title={subtitle} message="Welcome" />
      <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
        <BasicBtn insertText={insertText} defaultSubtitle={props.title} onSubtitleChange={setSubtitle} />
      </div>
    </div>
  );
};

export default App;
