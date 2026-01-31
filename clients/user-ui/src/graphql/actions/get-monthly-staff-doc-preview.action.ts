import { gql } from "@apollo/client";

export const GET_MONTHLY_STAFF_DOC_PREVIEW = gql`
  query GetMonthlyStaffDocPreview($userId: ID!, $month: Int!, $year: Int!) {
    getMonthlyStaffDocPreview(userId: $userId, month: $month, year: $year) {
      subSurveyActivityId
      activityName
      startDate
      endDate
      eligible
      totalDocs
      totalHonor
      unitCost
      budgetCode
    }
  }
`;
