"use client"

import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_OF_SUB_SURVEY_ACTIVITIES: DocumentNode = gql`
  query AllSubSurveyActivities {
    allSubSurveyActivities {
      id
      name
      slug
      surveyActivityId
      startDate
      endDate
      targetSample
      sampleType
      activityType
    }
  }
`;