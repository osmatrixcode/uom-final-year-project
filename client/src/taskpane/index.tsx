import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* global document, Office, module, require, HTMLElement */

const title = "Contoso Task Pane Add-in";

const queryClient = new QueryClient();

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
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
