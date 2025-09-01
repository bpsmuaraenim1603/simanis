"use client";

import { gql, DocumentNode } from "@apollo/client";

export const CREATE_CONTENT_ISSUE: DocumentNode = gql`
  mutation CreateContentIssue($input: CreateContentIssueDto!) {
    createContentIssue(input: $input) {
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
