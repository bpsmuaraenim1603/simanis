import { DocumentNode, gql } from "@apollo/client";

export const GET_CONTENT_ISSUES: DocumentNode = gql`
  query GetAllContentIssues {
    contentIssues {
      id
      content
      reporterId
      subSurveyActivityId
      issueStatus
      createdAt
      updatedAt
      reporter {
        id
        name
      }
      subSurveyActivity {
        id
        name
      }
    }
  }
`;