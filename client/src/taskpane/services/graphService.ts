import { acquireToken } from "./authService";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch<T>(path: string): Promise<T> {
  const token = await acquireToken(["User.Read", "Mail.Read"]);
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}

export interface GraphUser {
  displayName: string;
  mail: string;
  userPrincipalName: string;
  id: string;
}

export interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  body: { contentType: string; content: string };
}

/** Get the signed-in user's profile */
export async function getMe(): Promise<GraphUser> {
  return graphFetch<GraphUser>("/me");
}

/** Get a specific email message by its Exchange item ID */
export async function getMessage(outlookItemId: string): Promise<GraphMessage> {
  // Outlook item IDs need to be URL-encoded
  return graphFetch<GraphMessage>(`/me/messages/${encodeURIComponent(outlookItemId)}`);
}

/** Get recent messages from the inbox (useful for conversation history) */
export async function getRecentMessages(top = 10): Promise<GraphMessage[]> {
  const result = await graphFetch<{ value: GraphMessage[] }>(
    `/me/messages?$top=${top}&$select=id,subject,bodyPreview,from,receivedDateTime&$orderby=receivedDateTime desc`
  );
  return result.value;
}
