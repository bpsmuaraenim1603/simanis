import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_USER_ID = gql`
  query UserProgressSurveyByUserId($userId: String!) {
    userProgressSurveyByUserId(userId: $userId) {
      id
      userId
      subSurveyActivityId
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      blockCount
      villageName
      travelBill
      lastUpdated
      user {
        id
        name
        limit_bill
      }
      subSurveyActivity {
        id
        name
        activityType
      }
      district {
        id
        name
      }
    }
  }
`;
