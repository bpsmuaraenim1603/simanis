import { gql } from "@apollo/client";

export const GET_MONTHLY_STAFF_DOC_PREVIEW = gql`
  query GetMonthlyStaffDocPreview($userId: ID!, $month: Int!, $year: Int!) {
    getMonthlyStaffDocPreview(userId: $userId, month: $month, year: $year) {
      subSurveyActivityId
      activityName
      startDate
      endDate
      eligible
      spkEligible
      bastEligible
      includedSPK
      includedBAST
      spkMonth
      spkYear
      bastMonth
      bastYear
      totalDocs
      totalHonor
      unitCost
      budgetCode
    }
  }
`;
