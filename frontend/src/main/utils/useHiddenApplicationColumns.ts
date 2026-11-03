import { useEffect, useMemo, useRef } from "react";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import {
  APPLICATIONS_TABLE_KEY,
  DEFAULTS_MARKER,
  defaultHiddenColumns,
  type ApplicationType,
} from "main/utils/applicationColumns";

/**
 * Which columns the admin has hidden on a recruitment's table of applications (issue #189), and how
 * to hide or show one. The table of draft applications (issue #296) has the same columns, so it
 * shares this: hiding a column on one hides it on the other.
 *
 * The hidden columns are kept on the backend so they stay hidden across visits and browsers. The
 * first time a recruitment's table is opened, the columns that start hidden are written there,
 * with a marker so that an admin who later shows every column is not given the defaults again.
 */
export function useHiddenApplicationColumns(
  recruitmentId: string | undefined,
  recruitmentType: ApplicationType | undefined,
): {
  hiddenColumns: string[];
  toggleColumn: (columnId: string, hidden: boolean) => void;
} {
  // Stryker disable all : a shorter key still prefixes the same query; invalidation is tested
  const hiddenColumnsKey = [
    "/api/admin/hiddencolumns",
    APPLICATIONS_TABLE_KEY,
    recruitmentId,
  ];
  // Stryker restore all
  const { data: hiddenColumnsData, isFetchedAfterMount: hiddenColumnsFetched } =
    useBackend<string[]>(
      hiddenColumnsKey,
      {
        // Stryker disable next-line all : GET is axios's default method
        method: "GET",
        url: "/api/admin/hiddencolumns",
        params: { tableKey: APPLICATIONS_TABLE_KEY, recruitmentId },
      },
      // Stryker disable next-line all : don't test default value of empty list
      [],
    );
  // Stryker disable all : the query's initial data is an empty list, never undefined
  const hiddenColumns = useMemo(
    () => hiddenColumnsData ?? [],
    [hiddenColumnsData],
  );
  // Stryker restore all
  const hideColumnMutation = useBackendMutation<
    { columnId: string; hidden: boolean },
    string[]
  >(
    ({ columnId, hidden }) => ({
      url: "/api/admin/hiddencolumns",
      method: "PUT",
      params: {
        tableKey: APPLICATIONS_TABLE_KEY,
        recruitmentId,
        columnId,
        hidden,
      },
    }),
    {},
    hiddenColumnsKey,
  );
  const seedDefaultsMutation = useBackendMutation<string[], string[]>(
    (columnIds) => ({
      url: "/api/admin/hiddencolumns/all",
      method: "PUT",
      params: {
        tableKey: APPLICATIONS_TABLE_KEY,
        recruitmentId,
        columnIds: columnIds.join(","),
      },
    }),
    {},
    hiddenColumnsKey,
  );
  const defaultsChecked = useRef(false);
  const seedDefaults = seedDefaultsMutation.mutate;
  // Stryker disable all : the ref guard and the dependency list only matter across re-renders,
  // which the tests cannot tell apart; the seeding itself is tested
  useEffect(() => {
    if (
      defaultsChecked.current ||
      !hiddenColumnsFetched ||
      recruitmentType === undefined
    ) {
      return;
    }
    defaultsChecked.current = true;
    if (!hiddenColumns.includes(DEFAULTS_MARKER)) {
      seedDefaults(defaultHiddenColumns(recruitmentType));
    }
  }, [hiddenColumnsFetched, recruitmentType, hiddenColumns, seedDefaults]);
  // Stryker restore all

  return {
    hiddenColumns,
    toggleColumn: (columnId, hidden) =>
      hideColumnMutation.mutate({ columnId, hidden }),
  };
}
