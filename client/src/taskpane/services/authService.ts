import {
  createNestablePublicClientApplication,
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from "@azure/msal-browser";

// Set AZURE_CLIENT_ID in client/.env — see client/.env.example
export const MSAL_CLIENT_ID = process.env.AZURE_CLIENT_ID ?? "";

const GRAPH_SCOPES = ["User.Read", "Mail.Read"];

let msalInstance: IPublicClientApplication | null = null;

async function initMsal(): Promise<IPublicClientApplication> {
  if (!msalInstance) {
    msalInstance = await createNestablePublicClientApplication({
      auth: {
        clientId: MSAL_CLIENT_ID,
        // "common" supports both work/school and personal Microsoft accounts
        authority: "https://login.microsoftonline.com/common",
      },
      cache: {
        cacheLocation: "localStorage",
      },
    });
  }
  return msalInstance;
}

/**
 * Acquires an access token for the given scopes using NAA.
 * Since the user is already signed in to Outlook, this will succeed silently
 * (no login popup) in supported Office hosts.
 * Falls back to a popup dialog only if interaction is explicitly required
 * (e.g. first-time consent or MFA).
 */
export async function acquireToken(scopes: string[] = GRAPH_SCOPES): Promise<string> {
  const isNaaSupported =
    typeof Office !== "undefined" &&
    Office.context?.requirements?.isSetSupported("NestedAppAuth", "1.1");

  if (!isNaaSupported) {
    console.warn("NAA is not supported in this Office host version. Token acquisition may fail.");
  }

  const msal = await initMsal();

  try {
    const result = await msal.acquireTokenSilent({ scopes });
    console.log("NAA: Acquired token silently.");
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      console.log("NAA: Silent acquisition failed, falling back to popup.");
      const result = await msal.acquireTokenPopup({ scopes });
      return result.accessToken;
    }
    console.error("NAA: Token acquisition failed:", e);
    throw e;
  }
}

/**
 * Call this during Office.onReady to warm up the MSAL cache early.
 * This makes subsequent acquireToken calls faster and truly silent.
 */
export async function initAuth(): Promise<void> {
  try {
    await acquireToken(GRAPH_SCOPES);
  } catch (e) {
    // Non-fatal on startup — token will be acquired when first needed
    console.warn("NAA: Could not pre-acquire token on startup:", e);
  }
}
