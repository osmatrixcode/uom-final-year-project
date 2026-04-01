import * as React from "react";
import { tokens } from "../theme/tokens";
import { EmailRecipient, SendersResult } from "../taskpane";

interface SenderListProps {
  senders: SendersResult;
  selected: EmailRecipient | null;
  onSelect: (sender: EmailRecipient) => void;
  isLoading: boolean;
  selectionLocked?: boolean;
}

const SenderRow: React.FC<{
  sender: EmailRecipient;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ sender, isSelected, onSelect }) => {
  const accentColor = tokens.colors.accent;
  const initial = (sender.displayName || sender.emailAddress)[0].toUpperCase();

  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacing.md,
        width: "100%",
        background: isSelected ? `${accentColor}18` : "transparent",
        border: "none",
        borderLeft: isSelected ? `3px solid ${accentColor}` : "3px solid transparent",
        padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: isSelected ? accentColor : tokens.colors.border,
          color: isSelected ? "#fff" : tokens.colors.textSecondary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: tokens.font.label.size,
          fontWeight: tokens.font.label.weight,
          flexShrink: 0,
          transition: "background-color 0.15s ease",
        }}
      >
        {initial}
      </div>
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            fontSize: tokens.font.body.size,
            color: isSelected ? accentColor : tokens.colors.text,
            fontWeight: isSelected ? tokens.font.label.weight : tokens.font.body.weight,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sender.displayName || sender.emailAddress}
        </div>
        {sender.displayName && (
          <div
            style={{
              fontSize: tokens.font.caption.size,
              color: tokens.colors.placeholder,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sender.emailAddress}
          </div>
        )}
      </div>
    </button>
  );
};

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      padding: `${tokens.spacing.xs}px ${tokens.spacing.lg}px`,
      fontSize: tokens.font.caption.size,
      color: tokens.colors.accent,
      fontWeight: tokens.font.label.weight,
      letterSpacing: "0.02em",
      borderBottom: `1px solid ${tokens.colors.border}`,
      backgroundColor: `${tokens.colors.accent}08`,
    }}
  >
    {label}
  </div>
);

const SenderList: React.FC<SenderListProps> = ({ senders, selected, onSelect, isLoading, selectionLocked = false }) => {
  const handleSelect = (sender: EmailRecipient) => {
    if (selectionLocked) return;
    onSelect(sender);
  };
  const hasAny = senders.to.length > 0 || senders.cc.length > 0;

  return (
    <div
      style={{
        borderTop: `1px solid ${tokens.colors.border}`,
        borderBottom: `1px solid ${tokens.colors.border}`,
        backgroundColor: tokens.colors.surface,
        flexShrink: 0,
        maxHeight: 200,
        overflowY: "auto",
      }}
    >
      {isLoading ? (
        <div
          style={{
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.font.body.size,
            color: tokens.colors.placeholder,
          }}
        >
          Loading senders...
        </div>
      ) : !hasAny ? (
        <div
          style={{
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            fontSize: tokens.font.body.size,
            color: tokens.colors.placeholder,
          }}
        >
          No senders found.
        </div>
      ) : (
        <>
          {senders.to.length > 0 && (
            <>
              <SectionLabel label="To" />
              {senders.to.map((s) => (
                <SenderRow
                  key={s.emailAddress}
                  sender={s}
                  isSelected={selected?.emailAddress === s.emailAddress}
                  onSelect={() => handleSelect(s)}
                />
              ))}
            </>
          )}
          {senders.cc.length > 0 && (
            <>
              <SectionLabel label="CC" />
              {senders.cc.map((s) => (
                <SenderRow
                  key={s.emailAddress}
                  sender={s}
                  isSelected={selected?.emailAddress === s.emailAddress}
                  onSelect={() => handleSelect(s)}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SenderList;
