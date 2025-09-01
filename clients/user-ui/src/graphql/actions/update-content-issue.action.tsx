"use client";

import { gql, DocumentNode } from "@apollo/client";

export const UPDATE_CONTENT_ISSUE: DocumentNode = gql`
  mutation UpdateContentIssue($input: UpdateContentIssueDto!) {
    updateContentIssue(input: $input) {
      id
      content
      issueStatus
      reporterId
      subSurveyActivityId
      createdAt
      updatedAt
      reporter { id name email }
      subSurveyActivity { id name slug }
      IssueComment {
        id
        message
        userId
        subSurveyActivityId
        createdAt
        user { id name email }
        subSurveyActivity { id name slug }
      }
    }
  }
`;
