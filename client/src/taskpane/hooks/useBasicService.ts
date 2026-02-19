import { useMutation } from "@tanstack/react-query";
import { getBasicText, generateEmailReply } from "../services/basicService";
import { EmailContext } from "../taskpane";

/**
 * Hook for fetching basic data from the server
 * Transforms the raw API response into a string for insertion
 */
export function useBasicService() {
  return useMutation({ mutationFn: getBasicText });
}

export function useGenerateReply() {
  return useMutation<string, Error, EmailContext>({ mutationFn: generateEmailReply });
}
