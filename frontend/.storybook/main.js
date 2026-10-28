const config = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-docs",
    "@chromatic-com/storybook",
    "msw-storybook-addon",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // docs/legacy is served at /legacy, as the backend does in the real app.
  staticDirs: ["../public", { from: "../../docs/legacy", to: "/legacy" }],
};

export default config;
