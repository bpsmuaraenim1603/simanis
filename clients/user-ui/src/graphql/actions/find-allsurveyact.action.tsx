"use client"

import { DocumentNode, gql } from "@apollo/client";

export const GET_ALL_SURVEY_ACTIVITIES: DocumentNode = gql`
  query AllSurveyActivities {
    allSurveyActivities {
      id
      name
      slug
      chiefId
      chief {
        id
        name
      }
    }
  }
`;
