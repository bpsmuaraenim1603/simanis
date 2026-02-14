"use client"

import {gql, DocumentNode} from '@apollo/client';

export const ADD_SURVEY_ACTIVITY: DocumentNode = gql`
mutation AddSurveyActivity($input: CreateSurveyActivityDTO!) {
  createSurveyActivity(input: $input) {
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