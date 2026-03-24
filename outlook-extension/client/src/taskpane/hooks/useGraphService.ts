import { useQuery } from "@tanstack/react-query";
import { getMe, getMessage, getRecentMessages } from "../services/graphService";

/** Fetches the signed-in user's profile from Graph. Cached for 5 minutes. */
export function useMe() {
  return useQuery({
    queryKey: ["graph", "me"],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches a specific email message by its Outlook item ID. */
export function useMessage(outlookItemId: string | null | undefined) {
  return useQuery({
    queryKey: ["graph", "message", outlookItemId],
    queryFn: () => getMessage(outlookItemId!),
    enabled: !!outlookItemId,
    staleTime: 60 * 1000,
  });
}

/** Fetches the user's most recent inbox messages. */
export function useRecentMessages(top = 10) {
  return useQuery({
    queryKey: ["graph", "messages", top],
    queryFn: () => getRecentMessages(top),
    staleTime: 60 * 1000,
  });
}
