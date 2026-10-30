/** Rows of the UCSB quarter calendar, as /api/admin/quarters/all returns them (issue #151). */
const quartersFixtures = {
  f21: {
    quarter: "20214",
    qyy: "F21",
    name: "FALL 2021",
    category: "FALL",
    academicYear: "2021-2022",
    firstDayOfClasses: "2021-10-01T00:00:00",
    lastDayOfClasses: "2021-12-10T00:00:00",
    firstDayOfFinals: "2021-12-11T00:00:00",
    lastDayOfFinals: "2021-12-17T00:00:00",
    firstDayOfQuarter: "2021-09-26T00:00:00",
    lastDayOfSchedule: "2022-01-01T00:00:00",
    pass1Begin: "2021-05-10T09:00:00",
    pass2Begin: "2021-05-24T09:00:00",
    pass3Begin: "2021-06-07T09:00:00",
    feeDeadline: "2021-09-13T00:00:00",
    lastDayToAddUnderGrad: "2021-10-18T00:00:00",
    lastDayToAddGrad: "2021-10-18T00:00:00",
    lastDayThirdWeek: "2021-10-19T00:00:00",
  },
  w22: {
    quarter: "20221",
    qyy: "W22",
    name: "WINTER 2022",
    category: "WINTER",
    academicYear: "2021-2022",
    firstDayOfClasses: "2022-01-03T00:00:00",
    lastDayOfClasses: "2022-03-11T00:00:00",
    firstDayOfFinals: "2022-03-12T00:00:00",
    lastDayOfFinals: "2022-03-18T00:00:00",
    firstDayOfQuarter: "2022-01-03T00:00:00",
    lastDayOfSchedule: "2022-03-26T00:00:00",
    pass1Begin: "2021-11-08T09:00:00",
    pass2Begin: "2021-11-29T09:00:00",
    pass3Begin: "2021-12-13T09:00:00",
    feeDeadline: "2021-12-14T00:00:00",
    lastDayToAddUnderGrad: "2022-01-24T00:00:00",
    lastDayToAddGrad: "2022-01-24T00:00:00",
    lastDayThirdWeek: "2022-01-25T00:00:00",
  },
  /** A quarter the API knows little about yet: most dates null. */
  s22: {
    quarter: "20222",
    qyy: "S22",
    name: "SPRING 2022",
    category: "SPRING",
    academicYear: "2021-2022",
    firstDayOfClasses: "2022-03-28T00:00:00",
    lastDayOfClasses: null,
    firstDayOfFinals: null,
    lastDayOfFinals: null,
    firstDayOfQuarter: "2022-03-28T00:00:00",
    lastDayOfSchedule: null,
    pass1Begin: null,
    pass2Begin: null,
    pass3Begin: null,
    feeDeadline: null,
    lastDayToAddUnderGrad: null,
    lastDayToAddGrad: null,
    lastDayThirdWeek: null,
  },
};

/** Newest first, as the page asks for by default. */
quartersFixtures.threeNewestFirst = [
  quartersFixtures.s22,
  quartersFixtures.w22,
  quartersFixtures.f21,
];
quartersFixtures.threeOldestFirst = [
  ...quartersFixtures.threeNewestFirst,
].reverse();

/** What a refresh reports: the range checked and the rows saved. */
quartersFixtures.refresh = {
  start: "20214",
  end: "20222",
  quarters: quartersFixtures.threeOldestFirst,
};

export default quartersFixtures;
