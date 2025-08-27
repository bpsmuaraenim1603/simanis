import { gql } from "@apollo/client";

export const ADD_CONTENT_ISSUES = gql`
mutation AddContentIssues($input: CreateContentIssueDto!) {
  createContentIssue(input: $input) {
    content
    reporterId
    subSurveyActivityId
    issueStatus
  }
}
`;