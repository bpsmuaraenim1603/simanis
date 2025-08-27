import { gql } from "@apollo/client";

export const UPDATE_CONTENT_ISSUES_ACTION = gql`
  mutation UpdateContentIssue($input: UpdateContentIssueInput!) {
    updateContentIssue(input: $input) {
      id
      content
      issueStatus
      
    }
  }
`;
