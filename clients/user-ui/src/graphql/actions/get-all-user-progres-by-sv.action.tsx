import { DocumentNode, gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_SUPERVISOR: DocumentNode = gql`
  query UserProgressSurveyBySupervisorId($superVisorId: String!) {
    userProgressSurveyBySupervisorId(superVisorId: $superVisorId) {
      id
      userId
      superVisorId
      subSurveyActivityId
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      lastUpdated
      districtId
      villageId
      user {
        id
        name
        email
      }
      subSurveyActivity {
        id
        name
        activityType
        targetSample
      }
    }
  }
`;
