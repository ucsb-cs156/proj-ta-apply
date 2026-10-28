import React from "react";
import { Form } from "react-bootstrap";
import RequiredField from "main/components/Common/RequiredField";
import RequiredFieldExplanation from "main/components/Common/RequiredFieldExplanation";

export default {
  title: "components/Common/RequiredField",
  component: RequiredField,
};

export const Mark = () => <RequiredField />;

export const Explanation = () => <RequiredFieldExplanation />;

/** How the two are used together on a form. */
export const OnAForm = () => (
  <Form>
    <p>
      <RequiredFieldExplanation />
    </p>
    <Form.Group className="mb-3">
      <Form.Label htmlFor="name">
        Name <RequiredField />
      </Form.Label>
      <Form.Control id="name" />
    </Form.Group>
    <Form.Group className="mb-3">
      <Form.Label htmlFor="nickname">Nickname</Form.Label>
      <Form.Control id="nickname" />
    </Form.Group>
  </Form>
);
