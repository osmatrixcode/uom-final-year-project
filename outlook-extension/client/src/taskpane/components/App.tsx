import * as React from "react";
import { tokens } from "../theme/tokens";
import Header from "./Header";
import ConversationView from "./ConversationView";
import DraftBox from "./DraftBox";
import ChatInput, { InputMode } from "./ChatInput";
import { Message } from "./MessageBubble";
import { streamGenerateReply } from "../services/basicService";
import { getEmailContext, getSenders, insertText, getComposeBody, extractUserDraft, EmailRecipient, SendersResult } from "../taskpane";
import SenderList from "./SenderList";
import SenderProfilePanel from "./SenderProfilePanel";

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

  /* email_draft mode: single persistent draft — null means no draft active */
  const [currentDraft, setCurrentDraft] = React.useState<string | null>(null);

  /* sender_edit mode */
  const [senders, setSenders] = React.useState<SendersResult>({ to: [], cc: [] });
  const [sendersLoading, setSendersLoading] = React.useState(false);
  const [selectedSender, setSelectedSender] = React.useState<EmailRecipient | null>(null);

  const MODES: InputMode[] = ["general_qa", "email_draft", "sender_edit"];
  const handleModeSwitch = () => {
    setMode((prev) => {
      const idx = MODES.indexOf(prev);
      const next = MODES[(idx + 1) % MODES.length];
      if (next === "sender_edit") {
        setSendersLoading(true);
        setSenders({ to: [], cc: [] });
        setSelectedSender(null);
        getSenders().then((list) => {
          setSenders(list);
          setSendersLoading(false);
        });
      }
      return next;
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

    const currentMode = mode;

    if (currentMode === "email_draft") {
      /* In email_draft mode: only add the user instruction bubble; AI response
         goes into the persistent DraftBox rather than the message list. */
      setMessages((prev) => [...prev, { role: "user", content: text, mode: currentMode }]);
      setCurrentDraft(""); // empty string = streaming in progress
      setInstruction("");
      setIsPending(true);

      try {
        const context = await getEmailContext();

        /* Use explicit currentDraft if set; otherwise auto-read the compose
           body so user-written text is passed as draft context automatically. */
        let draftContent = currentDraft ?? undefined;
        if (!draftContent) {
          const composeBody = await getComposeBody();
          const userText = extractUserDraft(composeBody);
          if (userText) draftContent = userText;
        }

        await streamGenerateReply(
          { ...context, draft: draftContent, instruction: text, mode: currentMode },
          {
            onIntent: () => { /* email_draft always produces a draft */ },
            onToken: (token) => {
              setCurrentDraft((prev) => (prev ?? "") + token);
            },
            onDone: () => {
              setIsPending(false);
            },
            onError: (error) => {
              console.error("Streaming error:", error);
              setCurrentDraft(null);
              setIsPending(false);
            },
          }
        );
      } catch (error) {
        console.error("Failed to read email context:", error);
        setCurrentDraft(null);
        setIsPending(false);
      }
    } else {
      /* general_qa / sender_edit: conversation bubble flow */
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, mode: currentMode },
        { role: "ai", content: "", isStreaming: true, isDraft: false },
      ]);
      setInstruction("");
      setIsPending(true);

      try {
        const context = await getEmailContext();
        let resolvedIntent: "draft" | "qa" = "draft";

        const senderCtx = currentMode === "sender_edit" && selectedSender
          ? { senderName: selectedSender.displayName, senderEmail: selectedSender.emailAddress }
          : {};
        await streamGenerateReply(
          { ...context, instruction: text, mode: currentMode, ...senderCtx },
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
    }
  };

  /* general_qa / sender_edit draft handlers (bubble-style) */
  const handleInsert = (text: string) => {
    insertText(text);
    setMessages((prev) =>
      prev.map((m) => (m.content === text && m.isDraft ? { ...m, isDraft: false } : m))
    );
  };

  const handleDiscard = (index: number) => {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, isDraft: false } : m)));
  };

  /* email_draft DraftBox handlers */
  const handleDraftInsert = () => {
    if (currentDraft) insertText(currentDraft);
    setCurrentDraft(null);
    setMode("general_qa");
  };

  const handleDraftDiscard = () => {
    setCurrentDraft(null);
    setMode("general_qa");
  };

  const handleDraftImport = async () => {
    const body = await getComposeBody();
    if (body.trim()) setCurrentDraft(body.trim());
  };

  const handleDraftEdit = (content: string) => {
    setCurrentDraft(content);
  };

  const modeSwitchLocked = mode === "email_draft" && currentDraft !== null;
  const showDraftBox = mode === "email_draft" && currentDraft !== null;
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

      {showDraftBox && (
        <DraftBox
          content={currentDraft}
          isStreaming={isPending}
          onInsert={handleDraftInsert}
          onDiscard={handleDraftDiscard}
          onEdit={handleDraftEdit}
          onImport={handleDraftImport}
        />
      )}

      {mode === "sender_edit" && (
        <SenderList
          senders={senders}
          selected={selectedSender}
          onSelect={setSelectedSender}
          isLoading={sendersLoading}
        />
      )}

      {mode === "sender_edit" && selectedSender && (
        <SenderProfilePanel sender={selectedSender} />
      )}

      <ChatInput
        value={instruction}
        onChange={setInstruction}
        onSend={() => handleSend()}
        onModeSwitch={handleModeSwitch}
        mode={mode}
        modeSwitchLocked={modeSwitchLocked}
        disabled={isPending}
        placeholder={
          mode === "email_draft"
            ? currentDraft !== null
              ? "Refine the draft above..."
              : "Describe the reply you want..."
            : mode === "sender_edit"
            ? selectedSender
              ? `Ask about ${selectedSender.displayName || selectedSender.emailAddress}...`
              : "Select a sender above, then ask..."
            : hasMessages
            ? "Refine or ask a follow-up..."
            : "How can I help?"
        }
      />
    </div>
  );
};

export default App;
