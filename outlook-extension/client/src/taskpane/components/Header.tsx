import * as React from "react";
import { tokens } from "../theme/tokens";

export interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => (
  <div
    style={{
      width: "100%",
      padding: `${tokens.spacing.lg}px ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
      boxSizing: "border-box",
    }}
  >
    <h1
      style={{
        fontSize: tokens.font.title.size,
        fontWeight: tokens.font.title.weight,
        color: tokens.colors.text,
        margin: 0,
        lineHeight: 1.25,
      }}
    >
      {title}
    </h1>
  </div>
);

export default Header;
