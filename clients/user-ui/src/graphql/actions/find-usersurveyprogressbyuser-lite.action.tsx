import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_USER_ID_LITE = gql`
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
      docsBill
      lastUpdated
      superVisorId
      superVisor {
        id
        name
      }
      user {
        id
        name
        limit_bill
      }
      subSurveyActivity {
        id
        name
        activityType
        startDate
        endDate
        sampleType
      }
      district {
        id
        name
        city
        coderegion
      }
      village {
        id
        name
        coderegion
        districtId
      }
    }
  }
`;
