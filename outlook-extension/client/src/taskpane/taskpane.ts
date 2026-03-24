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

export async function insertText(text: string) {
  // Write text to the cursor point in the compose surface.
  try {
    Office.context.mailbox.item?.body.setSelectedDataAsync(
      text,
      { coercionType: Office.CoercionType.Text },
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
