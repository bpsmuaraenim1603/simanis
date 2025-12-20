import { gql } from "@apollo/client";

export const GET_STAFF_YEARLY_EXPORT = gql`
  query GetStaffYearlyExport($year: Int!) {
    getStaffYearlyExport(year: $year) {
      userId
      userName
      userLimitBill
      subSurveyActivityId
      subSurveyName
      activityType
      startDate
      month
      districtName
      blockCount
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      travelBill
    }
  }
`;
