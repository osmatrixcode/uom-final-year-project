You said
Creating Outlook Extension and need access to their emails via graph api. Already can load taskpane and basic backend. How to get a token of signed in user and use graph api on that

Gemini said
To access Microsoft Graph from an Outlook Extension (Add-in) as of 2026, the "Industry Standard" has shifted toward Nested App Authentication (NAA).

Older methods like the On-Behalf-Of (OBO) flow are now considered legacy for new development. NAA allows your add-in to "nest" within the host (Outlook) and inherit the user's active session to get a token directly.

1. Register the App for NAA
   In the Azure Portal (Entra ID), your registration needs a specific configuration:

Platform: Add a Single-page application (SPA) platform.

Redirect URI: Use brk-multihub://<your-domain> (e.g., brk-multihub://localhost:3000 for development). This "brk-multihub" protocol tells Office to broker the request.

API Permissions: Add Delegated permissions (e.g., Mail.Read, User.Read).

2. The Frontend Implementation (Office.js + MSAL)
   You should use the MSAL.js library specifically configured for NAA. This avoids the common issue where Outlook's iframe blocks the login popup.

Install the library:
npm install @azure/msal-browser

The Script:

3. Using the Token
   Once you have the token, you can call the Graph API directly from your frontend or pass it to your Python backend:

Comparison of Methods
Common Gotcha: The Manifest
Don't forget to update your manifest.xml. You must include the <WebApplicationInfo> section so Office knows which Client ID to trust:

Would you like me to show you how to securely validate this token on your Python backend once the frontend sends it over?

---

https://devblogs.microsoft.com/microsoft365dev/new-nested-app-authentication-for-office-add-ins-legacy-exchange-tokens-off-by-default-in-october-2024/
