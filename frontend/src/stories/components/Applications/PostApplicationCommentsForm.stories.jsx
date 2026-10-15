import React from "react";
import PostApplicationCommentsForm from "main/components/Applications/PostApplicationCommentsForm";

export default {
  title: "components/Applications/PostApplicationCommentsForm",
  component: PostApplicationCommentsForm,
};

const Template = (args) => <PostApplicationCommentsForm {...args} />;

export const Empty = Template.bind({});
Empty.args = { submitAction: (data) => console.log("submit", data) };

export const WithSavedComments = Template.bind({});
WithSavedComments.args = {
  initialContents: "I have since finished CS 130A.",
  submitAction: (data) => console.log("submit", data),
};
