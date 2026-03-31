import apiClient from "./apiClient";
import { acquireToken } from "./authService";
import { API_URL } from "../config";
import { EmailContext, getItemRestId, getConversationId } from "../taskpane";

export interface ReplyResult {
  reply: string;
  intent: "draft" | "qa";
}

export function getBasicData() {
  return apiClient("/langchain-hello", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.data?.message || JSON.stringify(response) || "No data received";
}

export interface StreamCallbacks {
  onIntent: (intent: "draft" | "qa") => void;
  onToken: (token: string) => void;
  onDone: (meta: { user_name: string | null; graph_enriched: boolean }) => void;
  onError: (error: Error) => void;
}

export async function streamGenerateReply(context: EmailContext & { mode?: string }, callbacks: StreamCallbacks): Promise<void> {
  const item_rest_id = getItemRestId();
  const conversation_id = getConversationId();

  let token: string | null = null;
  try {
    token = await acquireToken();
  } catch {
    // non-fatal — request proceeds without auth
  }

  const response = await fetch(`${API_URL}/generate-reply/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...context, item_rest_id, conversation_id }),
  });

  if (!response.ok || !response.body) {
    callbacks.onError(new Error(`Server error: ${response.status}`));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "intent") callbacks.onIntent(event.intent);
        else if (event.type === "token") callbacks.onToken(event.token);
        else if (event.type === "done") callbacks.onDone({ user_name: event.user_name, graph_enriched: event.graph_enriched });
        else if (event.type === "error") callbacks.onError(new Error(event.message));
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

export async function fetchThreadNote(conversationId: string): Promise<string> {
  const response = await apiClient.get(`/threads/${encodeURIComponent(conversationId)}`);
  return response.data.note_text ?? "";
}

export async function saveThreadNote(conversationId: string, text: string): Promise<void> {
  await apiClient.put(`/threads/${encodeURIComponent(conversationId)}`, { note_text: text });
}

export async function fetchProfile(email: string): Promise<string> {
  const response = await apiClient.get(`/profiles/${encodeURIComponent(email)}`);
  return response.data.prompt_text ?? "";
}

export async function saveProfile(email: string, text: string): Promise<void> {
  await apiClient.put(`/profiles/${encodeURIComponent(email)}`, { prompt_text: text });
}

export async function generateEmailReply(context: EmailContext): Promise<ReplyResult> {
  const item_rest_id = getItemRestId();
  const conversation_id = getConversationId();
  const response = await apiClient.post("/generate-reply", { ...context, item_rest_id, conversation_id });
  const { reply, graph_enriched, user_name, intent } = response.data;
  console.log(
    `[generateEmailReply] intent=${intent}`,
    `| source=${graph_enriched ? "Graph API" : "Office.js context"}`,
    `| user=${user_name ?? "unauthenticated"}`,
    `| item_rest_id=${item_rest_id ?? "none"}`,
    `| conversation_id=${conversation_id ?? "none"}`
  );
  return { reply, intent: intent ?? "draft" };
}
