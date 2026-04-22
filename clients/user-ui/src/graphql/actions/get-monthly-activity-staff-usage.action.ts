import { gql } from "@apollo/client";

export const GET_MONTHLY_ACTIVITY_STAFF_USAGE = gql`
  query GetMonthlyActivityStaffUsage($year: Int!, $month: Int) {
    getMonthlyActivityStaffUsage(year: $year, month: $month) {
      month
      subSurveyActivityId
      subSurveyName
      subSurveySlug
      surveyActivitySlug
      startDate
      endDate
      staffCount
      staffUsers {
        id
        name
        email
      }
    }
  }
`;
