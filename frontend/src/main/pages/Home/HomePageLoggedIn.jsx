import { useState } from "react";
import ProjectTable from "main/components/Projects/ProjectTable";
import ProjectModal from "main/components/Projects/ProjectModal";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import { useCurrentUser, hasRole } from "main/utils/currentUser";
import Button from "react-bootstrap/Button";

export default function HomePageLoggedIn() {
  const currentUser = useCurrentUser();
  const isInstructor =
    hasRole(currentUser, "ROLE_INSTRUCTOR") ||
    hasRole(currentUser, "ROLE_ADMIN");

  const {
    data: ownedProjects,
    error: _ownedError,
    status: _ownedStatus,
  } = useBackend(
    ["/api/projects/list/owner"],
    // Stryker disable next-line StringLiteral : The default value for an empty ("") method is GET.
    { method: "GET", url: "/api/projects/list/owner" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    false,
    {
      enabled: isInstructor,
    },
  );

  const {
    data: collaboratorProjects,
    error: _collaboratorError,
    status: _collaboratorStatus,
  } = useBackend(
    ["/api/projects/list/collaborator"],
    // Stryker disable next-line StringLiteral : The default value for an empty ("") method is GET.
    { method: "GET", url: "/api/projects/list/collaborator" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const [viewModal, setViewModal] = useState(false);

  const objectToAxiosParams = (project) => ({
    url: "/api/projects/post",
    method: "POST",
    params: {
      name: project.name,
      description: project.description,
      citationFormat: project.citationFormat,
    },
  });

  const onSuccess = (project) => {
    toast(`Project ${project.name} created`);
    setViewModal(false);
  };

  const mutation = useBackendMutation(objectToAxiosParams, { onSuccess }, [
    "/api/projects/list/owner",
  ]);

  const onSubmit = async (data) => {
    mutation.mutate(data);
  };

  const createProject = () => setViewModal(true);

  return (
    <BasicLayout>
      <div className="pt-2">
        {isInstructor && (
          <>
            <ProjectModal
              showModal={viewModal}
              toggleShowModal={setViewModal}
              onSubmitAction={onSubmit}
            />
            <Button
              onClick={createProject}
              style={{ float: "right", marginBottom: 10 }}
              variant="primary"
            >
              Create Project
            </Button>
            <h1>Your Projects</h1>
            {ownedProjects.length === 0 && (
              <p data-testid="HomePageLoggedIn-no-owned-projects">
                No projects yet. Click the button above to create one.
              </p>
            )}
            {ownedProjects.length > 0 && (
              <ProjectTable
                projects={ownedProjects}
                currentUser={currentUser}
                testId={"OwnerProjectTable"}
              />
            )}
          </>
        )}
        <h1>Projects You Collaborate On</h1>
        {collaboratorProjects.length === 0 && (
          <p data-testid="HomePageLoggedIn-no-collaborator-projects">
            You are not a collaborator on any projects yet.
          </p>
        )}
        {collaboratorProjects.length > 0 && (
          <ProjectTable
            projects={collaboratorProjects}
            currentUser={currentUser}
            testId={"CollaboratorProjectTable"}
          />
        )}
      </div>
    </BasicLayout>
  );
}
