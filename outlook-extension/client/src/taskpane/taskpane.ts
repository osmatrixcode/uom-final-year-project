/* global Office console */

export interface EmailRecipient {
  displayName: string;
  emailAddress: string;
}

export interface EmailContext {
  subject: string;
  body: string;
  recipients: EmailRecipient[];
  draft?: string;
  instruction?: string;
}

export function getEmailContext(): Promise<EmailContext> {
  const item = Office.context.mailbox.item;
  if (!item) {
    return Promise.reject(new Error("No mail item is currently active."));
  }

  const subjectPromise = new Promise<string>((resolve, reject) => {
    (item as Office.MessageCompose).subject.getAsync((result: Office.AsyncResult<string>) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(`Failed to read subject: ${result.error.message}`));
      }
    });
  });

  const bodyPromise = new Promise<string>((resolve, reject) => {
    item.body.getAsync(Office.CoercionType.Text, (result: Office.AsyncResult<string>) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(new Error(`Failed to read body: ${result.error.message}`));
      }
    });
  });

  const recipientsPromise = new Promise<EmailRecipient[]>((resolve, reject) => {
    (item as Office.MessageCompose).to.getAsync(
      (result: Office.AsyncResult<Office.EmailAddressDetails[]>) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          const mapped: EmailRecipient[] = result.value.map((r) => ({
            displayName: r.displayName,
            emailAddress: r.emailAddress,
          }));
          resolve(mapped);
        } else {
          reject(new Error(`Failed to read recipients: ${result.error.message}`));
        }
      }
    );
  });

  return Promise.all([subjectPromise, bodyPromise, recipientsPromise]).then(
    ([subject, body, recipients]) => ({ subject, body, recipients })
  );
}

export interface SendersResult {
  to: EmailRecipient[];
  cc: EmailRecipient[];
}

/**
 * Parses CC addresses from the quoted original email headers in the body text.
 * Used as a fallback when compose.cc is empty (e.g. when user clicked Reply, not Reply All).
 */
function parseCcFromBody(body: string): EmailRecipient[] {
  // Case-insensitive; strip trailing \r from Windows line endings
  const ccLineMatch = body.match(/^cc:\s*(.+?)\r?$/im);
  if (!ccLineMatch) return [];

  const results: EmailRecipient[] = [];
  for (const part of ccLineMatch[1].split(/;\s*|,\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const nameEmail = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
    if (nameEmail) {
      results.push({ displayName: nameEmail[1].trim(), emailAddress: nameEmail[2].trim() });
    } else if (trimmed.includes("@")) {
      results.push({ displayName: "", emailAddress: trimmed });
    }
  }
  return results;
}

/**
 * Returns the To and CC participants of the current email thread separately.
 * In simple Reply mode compose.cc is empty, so CC is parsed from the quoted body as fallback.
 */
export function getSenders(): Promise<SendersResult> {
  const item = Office.context.mailbox.item;
  if (!item) return Promise.resolve({ to: [], cc: [] });

  const fetchList = (getter: Office.Recipients): Promise<EmailRecipient[]> =>
    new Promise((resolve) => {
      getter.getAsync((result: Office.AsyncResult<Office.EmailAddressDetails[]>) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value.map((r) => ({ displayName: r.displayName, emailAddress: r.emailAddress })));
        } else {
          resolve([]);
        }
      });
    });

  const getBodyText = (): Promise<string> =>
    new Promise((resolve) => {
      item.body.getAsync(Office.CoercionType.Text, (r) => {
        resolve(r.status === Office.AsyncResultStatus.Succeeded ? r.value : "");
      });
    });

  const compose = item as Office.MessageCompose;
  return Promise.all([fetchList(compose.to), fetchList(compose.cc), getBodyText()]).then(
    ([toList, ccList, body]) => {
      console.log("[getSenders] ccList:", ccList, "body snippet:", body.slice(0, 500));
      const resolvedCc = ccList.length > 0 ? ccList : parseCcFromBody(body);

      // Deduplicate cc against to
      const toEmails = new Set(toList.map((r) => r.emailAddress.toLowerCase()));
      const dedupedCc = resolvedCc.filter((r) => !toEmails.has(r.emailAddress.toLowerCase()));

      return { to: toList, cc: dedupedCc };
    }
  );
}

/**
 * Returns the current email item's ID in REST format, suitable for Graph API calls.
 * Outlook's native itemId is in EWS format; Graph requires the REST-format ID.
 * Returns null if there is no active item or the conversion fails.
 * NOTE: itemId is null in compose mode (including replies) until the draft is saved.
 */
export function getItemRestId(): string | null {
  const item = Office.context.mailbox.item;
  if (!item?.itemId) return null;
  return Office.context.mailbox.convertToRestId(item.itemId, Office.MailboxEnums.RestVersion.v2_0);
}

/**
 * Returns the conversationId of the current mail item.
 * Unlike itemId, conversationId IS available in compose/reply mode.
 * Use this to fetch the full conversation thread from Graph when replying.
 */
export function getConversationId(): string | null {
  return Office.context.mailbox.item?.conversationId ?? null;
}

function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Use <br><br> for paragraph breaks — Outlook compose strips <p> margins
  return escaped.split(/\n\n+/).join("<br><br>").replace(/\n/g, "<br>");
}

export async function insertText(text: string) {
  // Replace the entire compose body with the generated draft.
  try {
    Office.context.mailbox.item?.body.setAsync(
      plainTextToHtml(text),
      { coercionType: Office.CoercionType.Html },
      (asyncResult: Office.AsyncResult<void>) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          throw asyncResult.error.message;
        }
      }
    );
  } catch (error) {
    console.log("Error: " + error);
  }
}

export function getComposeBody(): Promise<string> {
  const item = Office.context.mailbox.item;
  if (!item) return Promise.resolve("");
  return new Promise<string>((resolve) => {
    item.body.getAsync(Office.CoercionType.Text, (result: Office.AsyncResult<string>) => {
      resolve(result.status === Office.AsyncResultStatus.Succeeded ? result.value : "");
    });
  });
}

/**
 * Returns only the user-written portion of a compose body, stripping any
 * quoted original email content that Outlook appends below the reply area.
 */
export function extractUserDraft(body: string): string {
  const separators = [
    /\r?\nFrom: /,
    /\r?\n-----Original Message-----/,
    /\r?\nOn .+ wrote:/,
    /\r?\n________________________________/,
  ];
  let text = body;
  for (const sep of separators) {
    const idx = text.search(sep);
    if (idx !== -1) text = text.slice(0, idx);
  }
  return text.trim();
}
