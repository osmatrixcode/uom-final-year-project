import apiClient from "./apiClient";
import { EmailContext, getItemRestId, getConversationId } from "../taskpane";

export function getBasicData() {
  return apiClient("/langchain-hello", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.data?.message || JSON.stringify(response) || "No data received";
}

export async function generateEmailReply(context: EmailContext): Promise<string> {
  const item_rest_id = getItemRestId();
  const conversation_id = getConversationId();
  const response = await apiClient.post("/generate-reply", { ...context, item_rest_id, conversation_id });
  const { reply, graph_enriched, user_name } = response.data;
  console.log(
    `[generateEmailReply] source=${graph_enriched ? "Graph API" : "Office.js context"}`,
    `| user=${user_name ?? "unauthenticated"}`,
    `| item_rest_id=${item_rest_id ?? "none"}`,
    `| conversation_id=${conversation_id ?? "none"}`
  );
  return reply as string;
}
