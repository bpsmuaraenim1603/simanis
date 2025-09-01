"use client";

import { gql, DocumentNode } from "@apollo/client";

export const UPDATE_ISSUE_COMMENT: DocumentNode = gql`
  mutation UpdateIssueComment($input: updateIssueCommentDto!) {
    updateIssueComment(input: $input) {
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
