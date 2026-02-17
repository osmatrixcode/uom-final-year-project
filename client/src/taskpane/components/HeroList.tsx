import * as React from "react";
import { makeStyles } from "@fluentui/react-components";

export interface HeroListItem {
  primaryText: string;
}

export interface HeroListProps {
  message: string;
  items: HeroListItem[];
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
  message: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#000",
    margin: "0",
    lineHeight: "normal",
  },
  list: {
    margin: "0",
    padding: "0",
    listStyleType: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  bullet: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#0062AD",
    flexShrink: 0,
  },
  itemText: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#000",
    lineHeight: "normal",
  },
});

const HeroList: React.FC<HeroListProps> = (props: HeroListProps) => {
  const { items, message } = props;
  const styles = useStyles();

  return (
    <div className={styles.card}>
      <h2 className={styles.message}>{message}</h2>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li className={styles.listItem} key={index}>
            <div className={styles.bullet} />
            <span className={styles.itemText}>{item.primaryText}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HeroList;
