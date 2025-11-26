import { apiClient } from "./apiClient";

export function getBasicData() {
  return apiClient("/", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.text || JSON.stringify(response) || "No data received";
}
