import applicationsFixtures from "./applicationsFixtures";

function candidateApplication(application) {
  const {
    id,
    recruitmentId,
    email,
    submittedAt,
    adminComments: _adminComments,
    postApplicationComments,
    origin: _origin,
    status: _status,
    cancellationReason: _cancellationReason,
    cancelledAt: _cancelledAt,
    ...answers
  } = application;
  return {
    id,
    recruitmentId,
    email,
    submittedAt,
    postApplicationComments,
    answers,
  };
}

export default {
  ta: candidateApplication(applicationsFixtures.oneTaApplication),
  ula: candidateApplication(applicationsFixtures.oneUlaApplication),
};
