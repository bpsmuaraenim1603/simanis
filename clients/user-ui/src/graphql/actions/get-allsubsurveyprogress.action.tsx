import { gql } from "@apollo/client";

export const GET_REAL_ALL_SUB_SURVEY_PROGRESS = gql`
  query GetAllSubSurveyProgress {
    getAllSubSurveyProgress {
      startDate
      endDate
      targetSample
      totalPetugas
      submitCount
      approvedCount
      rejectedCount
      subSurveyActivityId
      name
    }
  }
`;
