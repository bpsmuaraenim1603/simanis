"use client"

import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_SUB_SURVEY_ACTIVITIES: DocumentNode = gql`
  query SubSurveyActivityById($surveyActivityId: String!) {
    subSurveyActivityById (surveyActivityId: $surveyActivityId) {
      id
      name
      slug
      surveyActivityId
      startDate
      endDate
      handoverMonth
      spkHandoverMonth
      bastHandoverMonth
      targetSample
      sampleType
      priceCompareUnit
      activityType
      status
      budgetCode
      unitWorkPrice
    }
  }
`;