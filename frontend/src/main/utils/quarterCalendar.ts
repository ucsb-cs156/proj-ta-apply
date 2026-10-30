/** One quarter of the UCSB quarter calendar, as /api/admin/quarters returns it (issue #151). */
export type UcsbApiQuarter = {
  quarter: string;
  qyy: string | null;
  name: string | null;
  category: string | null;
  academicYear: string | null;
  firstDayOfClasses: string | null;
  lastDayOfClasses: string | null;
  firstDayOfFinals: string | null;
  lastDayOfFinals: string | null;
  firstDayOfQuarter: string | null;
  lastDayOfSchedule: string | null;
  pass1Begin: string | null;
  pass2Begin: string | null;
  pass3Begin: string | null;
  feeDeadline: string | null;
  lastDayToAddUnderGrad: string | null;
  lastDayToAddGrad: string | null;
  lastDayThirdWeek: string | null;
};

/** What POST /api/admin/quarters/refresh reports. */
export type QuarterRefresh = {
  start: string;
  end: string;
  quarters: UcsbApiQuarter[];
};

/** The date fields of a quarter, in the order the card shows them, with their labels. */
export const QUARTER_DATE_FIELDS: {
  key: keyof UcsbApiQuarter;
  label: string;
  withTime?: boolean;
}[] = [
  { key: "firstDayOfQuarter", label: "First day of quarter" },
  { key: "firstDayOfClasses", label: "First day of classes" },
  { key: "lastDayToAddUnderGrad", label: "Last day to add (undergrad)" },
  { key: "lastDayToAddGrad", label: "Last day to add (grad)" },
  { key: "lastDayThirdWeek", label: "Last day of third week" },
  { key: "lastDayOfClasses", label: "Last day of classes" },
  { key: "firstDayOfFinals", label: "First day of finals" },
  { key: "lastDayOfFinals", label: "Last day of finals" },
  { key: "lastDayOfSchedule", label: "Last day of schedule" },
  { key: "feeDeadline", label: "Fee deadline" },
  { key: "pass1Begin", label: "Pass 1 begins", withTime: true },
  { key: "pass2Begin", label: "Pass 2 begins", withTime: true },
  { key: "pass3Begin", label: "Pass 3 begins", withTime: true },
];

/**
 * "2024-06-24T00:00:00" as "2024-06-24", or with its time ("2024-04-08 09:00") for the passes,
 * which begin at a time of day; blank for a missing value.
 */
export const showQuarterDate = (
  value: string | null | undefined,
  withTime = false,
): string => {
  if (!value) return "";
  const [date, time] = value.split("T");
  if (!withTime || !time) return date;
  return `${date} ${time.slice(0, 5)}`;
};

/** "Checked UCSB for quarters F21 through S22; 3 on file." */
export const refreshSummary = (
  refresh: QuarterRefresh,
  qyy: (yyyyq: string) => string,
): string =>
  `Checked UCSB for quarters ${qyy(refresh.start)} through ${qyy(refresh.end)}; ${refresh.quarters.length} saved.`;
