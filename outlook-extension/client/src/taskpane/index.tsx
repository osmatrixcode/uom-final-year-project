import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initAuth } from "./services/authService";

/* global document, Office, module, require, HTMLElement */

const title = "Intelligent AI Email Assistant";

const queryClient = new QueryClient();

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  // Warm up the MSAL token cache early so the first Graph call is silent.
  // Non-fatal if it fails — tokens will be acquired on demand.
  initAuth();

  root?.render(
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <App title={title} />
      </FluentProvider>
    </QueryClientProvider>
  );
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(NextApp);
  });
}
