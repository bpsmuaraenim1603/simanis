"use client";

import { gql, DocumentNode } from "@apollo/client";

export const ADD_ISSUE_COMMENT: DocumentNode = gql`
  mutation AddIssueComment($input: createIssueCommentDto!) {
    addIssueComment(input: $input) {
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
