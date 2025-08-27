"use client"

import { DocumentNode, gql } from "@apollo/client";

export const GET_SUB_SURVEY_ACTIVITIES_BY_SLUG: DocumentNode = gql`
  query SubSurveyActivityBySlug($slug: String!) {
    subSurveyActivityBySlug(slug: $slug) {
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
