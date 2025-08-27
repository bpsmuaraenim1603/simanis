"use client";

import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_SUB_SURVEY_PROGRESS: DocumentNode = gql`
  query SubSurveyProgress($subSurveyActivityId: String!) {
    subSurveyProgress(subSurveyActivityId: $subSurveyActivityId) {
      startDate
      endDate
      targetSample
      totalPetugas
      submitCount
      approvedCount
      rejectedCount
      sampleType
      activityType
    }
  }
`;
