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
      lastUpdated
      user {
        id
        name
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
