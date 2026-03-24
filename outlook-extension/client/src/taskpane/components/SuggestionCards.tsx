import * as React from "react";
import { tokens } from "../theme/tokens";
import SuggestionCard from "./SuggestionCard";

const SUGGESTIONS = [
  {
    icon: "💬",
    title: "Summarise this email",
    subtitle: "Summarise Email",
    prompt: "Summarise this email.",
  },
  {
    icon: "✍️",
    title: "Summarise and reply",
    subtitle: "Summarise and draft a reply",
    prompt: "Summarise this email and draft a reply.",
  },
  {
    icon: "📋",
    title: "Main takeaways",
    subtitle: "List key points as bullets",
    prompt: "List the main takeaways from this email in a bulleted list.",
  },
];

interface SuggestionCardsProps {
  onSend: (prompt: string) => void;
}

const SuggestionCards: React.FC<SuggestionCardsProps> = ({ onSend }) => {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? SUGGESTIONS : SUGGESTIONS.slice(0, 2);

  return (
    <div
      style={{
        padding: `0 ${tokens.spacing.lg}px ${tokens.spacing.sm}px`,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.xs,
        flexShrink: 0,
      }}
    >
      {visible.map((s) => (
        <SuggestionCard
          key={s.prompt}
          icon={s.icon}
          title={s.title}
          subtitle={s.subtitle}
          onClick={() => onSend(s.prompt)}
        />
      ))}

      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          alignSelf: "flex-end",
          background: "transparent",
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.pill,
          padding: `2px ${tokens.spacing.md}px`,
          fontSize: tokens.font.caption.size,
          color: tokens.colors.textSecondary,
          cursor: "pointer",
          marginTop: tokens.spacing.xs,
        }}
      >
        {expanded ? "See less ∧" : "See more ∨"}
      </button>
    </div>
  );
};

export default SuggestionCards;
