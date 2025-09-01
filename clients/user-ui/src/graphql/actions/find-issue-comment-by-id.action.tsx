"use client";

import { gql, DocumentNode } from "@apollo/client";

export const ISSUE_COMMENTS_BY_CONTENT: DocumentNode = gql`
  query IssueCommentsByContent($contentId: ID!) {
    issueCommentsByContent(contentId: $contentId) {
      id
      message
      userId
      subSurveyActivityId
      createdAt
      user { id name email }
      subSurveyActivity { id name slug }
    }
  }
`;
