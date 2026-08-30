import BasicLayout from "main/layouts/BasicLayout/BasicLayout";

export default function AboutTaApply() {
  return (
    <BasicLayout>
      <h1>About TaApply</h1>

      <p>
        TaApply is a UCSB CS project. This application shell was built from{" "}
        <a href="https://github.com/ucsb-cs156/proj-scaffold">proj-scaffold</a>,
        and provides Google sign-in, Admin/Instructor role management, a
        background jobs subsystem, and a Developer page.
      </p>
    </BasicLayout>
  );
}
