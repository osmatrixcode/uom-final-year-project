import axios from "axios";
import { API_URL } from "../config";
import { acquireToken } from "./authService";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 600000, // LLM + security pipeline can take up to 10 minutes
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the NAA-acquired token to every outgoing request.
// The token is acquired silently via the user's existing Outlook session.
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await acquireToken();
    config.headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    // Non-fatal: request proceeds without auth if token acquisition fails
    console.warn("apiClient: Could not attach auth token:", e);
  }
  return config;
});

export default apiClient;
