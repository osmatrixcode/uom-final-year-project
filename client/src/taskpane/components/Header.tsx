import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import { Eyes } from "./Eye";
import { useTheme } from "./ThemeContext";

export interface HeaderProps {
  title: string;
  logo: string;
  message: string;
}

const useStyles = makeStyles({
  card: {
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
    margin: "0",
  },
  heroSubtitle: {
    fontSize: "16px",
    fontWeight: "500",
    lineHeight: "normal",
    margin: "0",
  },
  heroCaption: {
    fontSize: "12px",
    fontWeight: "500",
    lineHeight: "normal",
    margin: "0",
  },
});

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { title, message } = props;
  const styles = useStyles();
  const { isDark } = useTheme();

  const cardBg = isDark ? "#2a2a3e" : "#FFFFFF";
  const textColor = isDark ? "#e0e0e0" : "#000";

  return (
    <div className={styles.card} style={{ backgroundColor: cardBg }}>
      <div className={styles.monster}>
        <Eyes />
      </div>
      <div className={styles.legend}>
        <div>
          <h1 className={styles.heroTitle} style={{ color: textColor }}>{message}</h1>
          <p className={styles.heroSubtitle} style={{ color: textColor }}>{title}</p>
        </div>
        <p className={styles.heroCaption} style={{ color: textColor }}>Intelligent Email Assistant</p>
      </div>
    </div>
  );
};

export default Header;
