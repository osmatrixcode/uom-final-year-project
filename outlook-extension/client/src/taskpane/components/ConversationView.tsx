import * as React from "react";
import { tokens } from "../theme/tokens";
import MessageBubble, { Message } from "./MessageBubble";

interface ConversationViewProps {
  messages: Message[];
  onInsert: (text: string) => void;
  onDiscard: (index: number) => void;
}

const ConversationView: React.FC<ConversationViewProps> = ({ messages, onInsert, onDiscard }) => {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: `${tokens.spacing.xs}px ${tokens.spacing.lg}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          message={msg}
          onInsert={onInsert}
          onDiscard={() => onDiscard(i)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default ConversationView;
