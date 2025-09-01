"use client";

import { gql, DocumentNode } from "@apollo/client";

export const CONTENT_ISSUES: DocumentNode = gql`
  query ContentIssues(
    $subSurveyActivityId: ID
    $status: IssueStatus
    $search: String
    $skip: Float
    $take: Float
  ) {
    contentIssues(
      subSurveyActivityId: $subSurveyActivityId
      status: $status
      search: $search
      skip: $skip
      take: $take
    ) {
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
