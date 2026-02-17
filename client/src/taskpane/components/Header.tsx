import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import { Eyes } from "./Eye";

export interface HeaderProps {
  title: string;
  logo: string;
  message: string;
}

const useStyles = makeStyles({
  // Outer cream card
  card: {
    backgroundColor: "#FBF0DC",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    boxSizing: "border-box",
  },
  // Blue area with eyes
  monster: {
    backgroundColor: "#0062AD",
    width: "100%",
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Text area below the eyes
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    paddingTop: "6px",
    paddingBottom: "6px",
  },
  heroTitle: {
    fontSize: "36px",
    fontWeight: "700",
    lineHeight: "40px",
    color: "#000",
    margin: "0",
  },
  heroSubtitle: {
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "normal",
    color: "#000",
    margin: "0",
  },
  heroCaption: {
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "normal",
    color: "#000",
    margin: "0",
  },
});

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { title, message } = props;
  const styles = useStyles();

  return (
    <div className={styles.card}>
      <div className={styles.monster}>
        <Eyes />
      </div>
      <div className={styles.legend}>
        <div>
          <h1 className={styles.heroTitle}>{message}</h1>
          <p className={styles.heroSubtitle}>{title}</p>
        </div>
        <p className={styles.heroCaption}>Intelligent Email Assistant</p>
      </div>
    </div>
  );
};

export default Header;
