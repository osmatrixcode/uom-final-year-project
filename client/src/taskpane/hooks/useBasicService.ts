import { useMutation } from "@tanstack/react-query";
import { getBasicText } from "../services/basicService";

/**
 * Hook for fetching basic data from the server
 * Transforms the raw API response into a string for insertion
 */
export function useBasicService() {
  return useMutation({ mutationFn: getBasicText });
}
