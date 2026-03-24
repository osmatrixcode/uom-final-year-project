import * as React from "react";
import { tokens } from "../theme/tokens";

interface SuggestionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ icon, title, subtitle, onClick }) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacing.md,
        width: "100%",
        backgroundColor: hovered ? tokens.colors.surface : "transparent",
        border: `1px solid ${hovered ? tokens.colors.border : "transparent"}`,
        borderRadius: tokens.radius.md,
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        textAlign: "left",
        cursor: "pointer",
        boxShadow: hovered ? tokens.shadow.card : "none",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: "16px", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: tokens.font.body.size,
            fontWeight: 600,
            color: tokens.colors.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: tokens.font.caption.size,
            color: tokens.colors.textSecondary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </span>
      </div>
    </button>
  );
};

export default SuggestionCard;
