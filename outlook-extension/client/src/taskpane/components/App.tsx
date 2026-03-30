import * as React from "react";
import { tokens } from "../theme/tokens";
import Header from "./Header";
import ConversationView from "./ConversationView";
import ChatInput, { InputMode } from "./ChatInput";
import { Message } from "./MessageBubble";
import { streamGenerateReply } from "../services/basicService";
import { getEmailContext, insertText } from "../taskpane";

const LOADING_PHRASES = [
  "Herding the cats...",
  "Boiling the ocean...",
  "Circling back with the AI...",
  "Leveraging synergies...",
  "Thinking outside the inbox...",
  "Picking the low-hanging fruit...",
  "Consulting the reply oracle...",
  "Summoning professional prose...",
  "Counting tokens...",
  "Asking the AI nicely...",
];

interface AppProps {
  title: string;
}

const App: React.FC<AppProps> = ({ title }) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [instruction, setInstruction] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [headerTitle, setHeaderTitle] = React.useState(title);
  const [mode, setMode] = React.useState<InputMode>("general_qa");

  const MODES: InputMode[] = ["general_qa", "email_draft", "sender_edit"];
  const handleModeSwitch = () => {
    setMode((prev) => {
      const idx = MODES.indexOf(prev);
      return MODES[(idx + 1) % MODES.length];
    });
  };

  /* Cycle loading phrases while streaming */
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPending) {
      const shuffled = [...LOADING_PHRASES].sort(() => Math.random() - 0.5);
      let idx = 0;
      setHeaderTitle(shuffled[idx]);
      interval = setInterval(() => {
        idx = (idx + 1) % shuffled.length;
        setHeaderTitle(shuffled[idx]);
      }, 1800);
    } else {
      setHeaderTitle(title);
    }
    return () => { if (interval !== null) clearInterval(interval); };
  }, [isPending, title]);

  const handleSend = async (prompt?: string) => {
    const text = (prompt ?? instruction).trim();
    if (!text || isPending) return;

    const lastDraft = [...messages].reverse().find((m) => m.role === "ai" && m.isDraft);

    /* Add user bubble + empty streaming AI bubble */
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "ai", content: "", isStreaming: true, isDraft: false },
    ]);
    setInstruction("");
    setIsPending(true);

    try {
      const context = await getEmailContext();
      let resolvedIntent: "draft" | "qa" = "draft";

      await streamGenerateReply(
        { ...context, draft: lastDraft?.content ?? undefined, instruction: text, mode },
        {
          onIntent: (intent) => {
            resolvedIntent = intent;
          },
          onToken: (token) => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "ai") {
                next[next.length - 1] = { ...last, content: last.content + token };
              }
              return next;
            });
          },
          onDone: () => {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "ai") {
                next[next.length - 1] = {
                  ...last,
                  isStreaming: false,
                  isDraft: resolvedIntent !== "qa",
                };
              }
              return next;
            });
            setIsPending(false);
          },
          onError: (error) => {
            console.error("Streaming error:", error);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "ai") {
                next[next.length - 1] = {
                  ...last,
                  content: `Something went wrong: ${error.message}`,
                  isStreaming: false,
                  isDraft: false,
                };
              }
              return next;
            });
            setIsPending(false);
          },
        }
      );
    } catch (error) {
      console.error("Failed to read email context:", error);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "ai") {
          next[next.length - 1] = {
            ...last,
            content: `Could not read email: ${error instanceof Error ? error.message : "Unknown error"}`,
            isStreaming: false,
            isDraft: false,
          };
        }
        return next;
      });
      setIsPending(false);
    }
  };

  const handleInsert = (text: string) => {
    insertText(text);
    setMessages((prev) =>
      prev.map((m) => (m.content === text && m.isDraft ? { ...m, isDraft: false } : m))
    );
  };

  const handleDiscard = (index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, isDraft: false } : m)));
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: tokens.colors.background,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Header title={headerTitle} />

      {hasMessages ? (
        <ConversationView
          messages={messages}
          onInsert={handleInsert}
          onDiscard={handleDiscard}
        />
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <ChatInput
        value={instruction}
        onChange={setInstruction}
        onSend={() => handleSend()}
        onModeSwitch={handleModeSwitch}
        mode={mode}
        disabled={isPending}
        placeholder={hasMessages ? "Refine or ask a follow-up..." : "How can I help?"}
      />
    </div>
  );
};

export default App;
