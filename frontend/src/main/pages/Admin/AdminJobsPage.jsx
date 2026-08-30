import React from "react";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import JobsTable from "main/components/Jobs/JobsTable";
import { useBackend } from "main/utils/useBackend";
import { Button } from "react-bootstrap";
import Accordion from "react-bootstrap/Accordion";
import SingleButtonJobForm from "main/components/Jobs/SingleButtonJobForm";
import { useBackendMutation } from "main/utils/useBackend";

export default function AdminJobsPage() {
  const objectToAxiosParamsTestJob = () => ({
    url: "/api/jobs/launch/testjob",
    method: "POST",
  });

  const testJobMutation = useBackendMutation(objectToAxiosParamsTestJob, {}, [
    "/api/jobs/all",
  ]);

  const submitTestJob = async () => {
    testJobMutation.mutate();
  };

  // purge job
  const objectToAxiosParamsPurgeJobLog = () => ({
    url: "/api/jobs/all",
    method: "DELETE",
  });

  const purgeJobLogMutation = useBackendMutation(
    objectToAxiosParamsPurgeJobLog,
    {},
    ["/api/jobs/all"],
  );

  const purgeJobLog = async () => {
    purgeJobLogMutation.mutate();
  };

  const { data: jobs, refetch } = useBackend(
    ["/api/jobs/all"],
    {
      //Stryker disable next-line StringLiteral: axios default is GET
      method: "GET",
      url: "/api/jobs/all",
    },
    [],
  );

  const jobLaunchers = [
    {
      name: "Test Job",
      form: (
        <SingleButtonJobForm
          callback={submitTestJob}
          text={"Start"}
          testid={"testJob"}
        />
      ),
    },
  ];

  return (
    <BasicLayout>
      <h2 className="p-3">Launch Jobs</h2>
      <Accordion>
        {jobLaunchers.map((jobLauncher, index) => (
          <Accordion.Item eventKey={index} key={index}>
            <Accordion.Header>{jobLauncher.name}</Accordion.Header>
            <Accordion.Body>{jobLauncher.form}</Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
      <h2 className="p-3">Job Status</h2>
      <JobsTable jobs={jobs} onCancelled={refetch} />
      <Button variant="danger" onClick={purgeJobLog} data-testid="purgeJobLog">
        Purge Job Log
      </Button>
    </BasicLayout>
  );
}
