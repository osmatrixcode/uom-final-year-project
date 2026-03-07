import apiClient from "./apiClient";
import { EmailContext, getItemRestId, getConversationId } from "../taskpane";

export interface ReplyResult {
  reply: string;
  intent: "draft" | "qa";
  clarifying_questions?: string[];
}

export function getBasicData() {
  return apiClient("/langchain-hello", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.data?.message || JSON.stringify(response) || "No data received";
}

export interface ClarifyingAnswer {
  question: string;
  answer: string;
}

export async function generateEmailReply(
  context: EmailContext,
  clarifying_answers?: ClarifyingAnswer[]
): Promise<ReplyResult> {
  const item_rest_id = getItemRestId();
  const conversation_id = getConversationId();
  const response = await apiClient.post("/generate-reply", {
    ...context,
    item_rest_id,
    conversation_id,
    clarifying_answers: clarifying_answers ?? undefined,
  });
  const { reply, graph_enriched, user_name, intent, clarifying_questions } = response.data;
  console.log(
    `[generateEmailReply] intent=${intent ?? "questions"}`,
    `| source=${graph_enriched ? "Graph API" : "Office.js context"}`,
    `| user=${user_name ?? "unauthenticated"}`,
    `| item_rest_id=${item_rest_id ?? "none"}`,
    `| conversation_id=${conversation_id ?? "none"}`
  );
  return { reply, intent: intent ?? "draft", clarifying_questions };
}
