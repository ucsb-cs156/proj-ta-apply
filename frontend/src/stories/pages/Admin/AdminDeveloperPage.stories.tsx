import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDeveloperPage from "main/pages/Admin/AdminDeveloperPage";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const meta: Meta<typeof AdminDeveloperPage> = {
  title: "pages/Admin/AdminDeveloperPage",
  component: AdminDeveloperPage,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      queryClient.setQueryData(["systemInfo"], systemInfoFixtures.showingBoth);
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof AdminDeveloperPage>;

export const Default: Story = {};
