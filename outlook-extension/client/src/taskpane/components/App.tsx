import * as React from "react";
import { tokens } from "../theme/tokens";
import Header from "./Header";
import ConversationView from "./ConversationView";
import DraftBox from "./DraftBox";
import ChatInput, { InputMode } from "./ChatInput";
import { Message } from "./MessageBubble";
import { streamGenerateReply, refineProfile, refineThreadNote } from "../services/basicService";
import { getEmailContext, getSenders, getConversationId, insertText, getComposeBody, extractUserDraft, EmailRecipient, SendersResult } from "../taskpane";
import SenderList from "./SenderList";
import SenderProfilePanel, { SenderProfilePanelHandle } from "./SenderProfilePanel";
import ThreadNotePanel, { ThreadNotePanelHandle } from "./ThreadNotePanel";

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
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [profileDirty, setProfileDirty] = React.useState(false);
  const [threadNoteDirty, setThreadNoteDirty] = React.useState(false);
  const [saveFlash, setSaveFlash] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<"profile" | "thread" | null>(null);
  const profileRef = React.useRef<SenderProfilePanelHandle>(null);
  const threadNoteRef = React.useRef<ThreadNotePanelHandle>(null);

  const MODES: InputMode[] = ["general_qa", "email_draft", "sender_edit"];
  const handleModeSwitch = () => {
    setMode((prev) => {
      const idx = MODES.indexOf(prev);
      const next = MODES[(idx + 1) % MODES.length];
      if (next === "sender_edit") {
        setSendersLoading(true);
        setSenders({ to: [], cc: [] });
        setSelectedSender(null);
        setConversationId(getConversationId());
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

    if (currentMode === "sender_edit" && activePanel) {
      /* sender_edit: refine the active panel's text via AI */
      setInstruction("");
      setIsPending(true);
      try {
        if (activePanel === "profile" && selectedSender && profileRef.current) {
          const currentText = profileRef.current.getText();
          const refined = await refineProfile(selectedSender.emailAddress, currentText, text);
          profileRef.current.setText(refined);
        } else if (activePanel === "thread" && conversationId && threadNoteRef.current) {
          const currentText = threadNoteRef.current.getText();
          const refined = await refineThreadNote(conversationId, currentText, text);
          threadNoteRef.current.setText(refined);
        }
      } catch (error) {
        console.error("Refine failed:", error);
      }
      setIsPending(false);
      return;
    }

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

  /* Global save for sender_edit mode */
  const handleSenderEditSave = async () => {
    const saves: Promise<void>[] = [];
    if (profileDirty && profileRef.current) saves.push(profileRef.current.save());
    if (threadNoteDirty && threadNoteRef.current) saves.push(threadNoteRef.current.save());
    await Promise.all(saves);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const senderEditDirty = mode === "sender_edit" && (profileDirty || threadNoteDirty);
  const modeSwitchLocked = (mode === "email_draft" && currentDraft !== null) || senderEditDirty;
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

      {mode === "sender_edit" && conversationId && (
        <ThreadNotePanel ref={threadNoteRef} conversationId={conversationId} onDirtyChange={setThreadNoteDirty} onFocus={() => setActivePanel("thread")} />
      )}

      {mode === "sender_edit" && (
        <SenderList
          senders={senders}
          selected={selectedSender}
          onSelect={setSelectedSender}
          isLoading={sendersLoading}
          selectionLocked={profileDirty}
        />
      )}

      {mode === "sender_edit" && selectedSender && (
        <SenderProfilePanel ref={profileRef} sender={selectedSender} onDirtyChange={setProfileDirty} onFocus={() => setActivePanel("profile")} />
      )}

      {mode === "sender_edit" && (
        <div
          style={{
            padding: `${tokens.spacing.xs}px ${tokens.spacing.lg}px`,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: tokens.spacing.sm,
            flexShrink: 0,
          }}
        >
          {saveFlash && (
            <span style={{ fontSize: tokens.font.caption.size, color: "#107C41" }}>
              Saved ✓
            </span>
          )}
          <button
            onClick={handleSenderEditSave}
            disabled={!senderEditDirty}
            style={{
              background: senderEditDirty ? tokens.colors.accent : tokens.colors.border,
              color: senderEditDirty ? "#fff" : tokens.colors.placeholder,
              border: "none",
              borderRadius: tokens.radius.pill,
              padding: `${tokens.spacing.xs}px ${tokens.spacing.lg}px`,
              fontSize: tokens.font.label.size,
              fontWeight: tokens.font.label.weight,
              cursor: senderEditDirty ? "pointer" : "not-allowed",
              opacity: senderEditDirty ? 1 : 0.5,
              transition: "all 0.15s ease",
            }}
          >
            Save
          </button>
        </div>
      )}

      <ChatInput
        value={instruction}
        onChange={setInstruction}
        onSend={() => handleSend()}
        onModeSwitch={handleModeSwitch}
        mode={mode}
        modeSwitchLocked={modeSwitchLocked}
        lockHintMessage={senderEditDirty ? "Save changes first" : "Insert or discard draft first"}
        disabled={isPending}
        placeholder={
          mode === "email_draft"
            ? currentDraft !== null
              ? "Refine the draft above..."
              : "Describe the reply you want..."
            : mode === "sender_edit"
            ? activePanel === "profile" && selectedSender
              ? `Refine profile for ${selectedSender.displayName || selectedSender.emailAddress}...`
              : activePanel === "thread"
              ? "Refine thread notes..."
              : "Click a text box above, then type an instruction..."
            : hasMessages
            ? "Refine or ask a follow-up..."
            : "How can I help?"
        }
      />
    </div>
  );
};

export default App;
