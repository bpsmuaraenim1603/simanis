"use client";

import { gql, DocumentNode } from "@apollo/client";

export const CONTENT_ISSUE_BY_ID: DocumentNode = gql`
  query ContentIssueById($id: ID!) {
    contentIssueById(id: $id) {
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
