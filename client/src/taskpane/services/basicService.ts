import apiClient from "./apiClient";
import { EmailContext } from "../taskpane";

export function getBasicData() {
  return apiClient("/langchain-hello", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.data?.message || JSON.stringify(response) || "No data received";
}

export async function generateEmailReply(context: EmailContext): Promise<string> {
  const response = await apiClient.post("/generate-reply", context);
  return response.data.reply as string;
}
