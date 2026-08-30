import { useState } from "react";
import "bootstrap/dist/css/bootstrap.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { initialize, mswLoader } from "msw-storybook-addon";

// Initialize MSW
initialize();

export const loaders = [mswLoader];

const preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [
    // A story for a page that reads route params (useParams()) can't just nest a second
    // MemoryRouter with its own initialEntries — react-router throws on nested Routers. Instead
    // it sets `parameters: { reactRouter: { initialEntries: [...] } }` and this shared decorator
    // threads that through to the one MemoryRouter every story already renders inside.
    (Story, context) => {
      // A fresh QueryClient per story, not one shared for the whole Storybook session (issue
      // #116): Storybook doesn't reload the page when you navigate between stories via the
      // sidebar, so a single shared client's cache persisted across that navigation. Stories
      // that share query keys (e.g. BibTexEntryShowPage's Default/Loading/EntryNotFound, which
      // all intentionally point at the same entry/route to represent different fetch states of
      // it) would then show a previous story's cached data instead of their own, until a full
      // page refresh cleared it.
      const [queryClient] = useState(() => new QueryClient());
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={
              context.parameters.reactRouter?.initialEntries ?? ["/"]
            }
          >
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
