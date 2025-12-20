import { gql } from "@apollo/client";

export const GET_MONTHLY_DASHBOARD_STATS = gql`
  query GetMonthlySurveyStats($subSurveyActivityId: ID) {
    getMonthlySurveyStats(subSurveyActivityId: $subSurveyActivityId) {
      totalJobLetters
      totalSPJ
      totalActiveUsers
    }
  }
`;