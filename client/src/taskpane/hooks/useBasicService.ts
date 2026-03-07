import { useMutation } from "@tanstack/react-query";
import { getBasicText, generateEmailReply, type ReplyResult, type ClarifyingAnswer } from "../services/basicService";
import { EmailContext } from "../taskpane";

/**
 * Hook for fetching basic data from the server
 * Transforms the raw API response into a string for insertion
 */
export function useBasicService() {
  return useMutation({ mutationFn: getBasicText });
}

export interface GenerateReplyInput extends EmailContext {
  clarifying_answers?: ClarifyingAnswer[];
}

export function useGenerateReply() {
  return useMutation<ReplyResult, Error, GenerateReplyInput>({
    mutationFn: ({ clarifying_answers, ...context }) => generateEmailReply(context, clarifying_answers),
  });
}
