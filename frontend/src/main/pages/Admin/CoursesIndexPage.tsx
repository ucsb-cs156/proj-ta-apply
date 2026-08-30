import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import CourseTable, { type Course } from "main/components/Courses/CourseTable";
import SingleQuarterDropdown from "main/components/Quarters/SingleQuarterDropdown";
import SingleLevelDropdown from "main/components/Levels/SingleLevelDropdown";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useSystemInfo } from "main/utils/systemInfo";
import { quarterRange, toNumericYYYYQ } from "main/utils/quarterUtilities";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";

// Stryker disable all : testing specific hard-coded dropdown options is just writing the code twice
const levels = [
  ["U", "Undergraduate"],
  ["G", "Graduate"],
  ["A", "All"],
];
// Stryker restore all

type PopulateParams = {
  startQuarter: string;
  endQuarter: string;
  level: string;
};

export default function CoursesIndexPage(): React.JSX.Element {
  const { data: systemInfo } = useSystemInfo();

  // Stryker disable OptionalChaining
  const startQtr = systemInfo?.startQtrYYYYQ || "20211";
  const endQtr = systemInfo?.endQtrYYYYQ || "20254";
  const subjectArea = systemInfo?.subjectArea || "CMPSC";
  // Stryker restore OptionalChaining

  const quarters = quarterRange(startQtr, endQtr);

  const [startQuarter, setStartQuarter] = useState(quarters[0].yyyyq);
  const [endQuarter, setEndQuarter] = useState(
    quarters[quarters.length - 1].yyyyq,
  );
  const [level, setLevel] = useState("U");

  const { data: courses } = useBackend<Course[]>(
    ["/api/courses/all"],
    { method: "GET", url: "/api/courses/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const objectToAxiosParams = (params: PopulateParams): AxiosRequestConfig => ({
    url: "/api/jobs/launch/populateCourses",
    method: "POST",
    params,
  });

  const populateMutation = useBackendMutation<PopulateParams, unknown>(
    objectToAxiosParams,
    {
      onSuccess: () => {
        toast(
          "Populate job started. Watch its progress on the Admin > Jobs page.",
        );
      },
    },
    ["/api/courses/all"],
  );

  const onPopulate = () => {
    if (toNumericYYYYQ(startQuarter) > toNumericYYYYQ(endQuarter)) {
      toast("Start quarter must not be after end quarter.");
      return;
    }
    populateMutation.mutate({ startQuarter, endQuarter, level });
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Courses</h1>
        <p>
          Courses in <strong>{subjectArea}</strong> that have been offered in
          the quarters you populate. Tick the boxes to mark which courses should
          get TAs and ULAs assigned.
        </p>

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            onPopulate();
          }}
        >
          <div className="d-flex gap-3 align-items-end flex-wrap mb-3">
            <SingleQuarterDropdown
              quarters={quarters}
              quarter={startQuarter}
              setQuarter={setStartQuarter}
              controlId="CoursesIndexPage.StartQuarter"
              label="Start Quarter"
            />
            <SingleQuarterDropdown
              quarters={quarters}
              quarter={endQuarter}
              setQuarter={setEndQuarter}
              controlId="CoursesIndexPage.EndQuarter"
              label="End Quarter"
            />
            <SingleLevelDropdown
              levels={levels}
              level={level}
              setLevel={setLevel}
              controlId="CoursesIndexPage.Level"
            />
            <Button type="submit" data-testid="CoursesIndexPage-populate">
              Populate
            </Button>
          </div>
        </Form>

        <CourseTable courses={courses ?? []} testIdPrefix="CoursesIndexPage" />
      </div>
    </BasicLayout>
  );
}
