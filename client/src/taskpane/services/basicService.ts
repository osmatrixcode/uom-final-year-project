import { apiClient } from "./apiClient";

export function getBasicData() {
  return apiClient("/hello", { method: "GET" });
}

export async function getBasicText(): Promise<string> {
  const response = await getBasicData();
  return response?.message || JSON.stringify(response) || "No data received";
}
