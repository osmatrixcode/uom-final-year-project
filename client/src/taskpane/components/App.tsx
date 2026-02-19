import * as React from "react";
import Header from "./Header";
import { Button, makeStyles } from "@fluentui/react-components";
import { insertText } from "../taskpane";
import BasicBtn from "./BasicBtn";
import { ThemeProvider, useTheme } from "./ThemeContext";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    boxSizing: "border-box",
  },
  topBar: {
    width: "100%",
    display: "flex",
    justifyContent: "flex-end",
  },
  toggleBtn: {
    minWidth: "32px",
    padding: "4px",
    backgroundColor: "transparent",
    color: "#fff",
    ":hover": {
      backgroundColor: "rgba(255,255,255,0.15)",
    },
  },
});

const AppContent: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();
  const { isDark, toggleDark } = useTheme();

  return (
    <div className={styles.root} style={{ backgroundColor: isDark ? "#1a1a2e" : "#0062AD" }}>
      <div className={styles.topBar}>
        <Button
          className={styles.toggleBtn}
          appearance="subtle"
          icon={isDark ? "\u2600" : "\u263D"}
          onClick={toggleDark}
        />
      </div>
      <Header logo="assets/logo-filled.png" title={props.title} message="Welcome" />
      <BasicBtn insertText={insertText} />
    </div>
  );
};

const App: React.FC<AppProps> = (props: AppProps) => {
  return (
    <ThemeProvider>
      <AppContent {...props} />
    </ThemeProvider>
  );
};

export default App;
