import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_SUBSURVEY_ID = gql`
  query UserProgressBySubSurveyActivityId($subSurveyActivityId: String!) {
    userProgressBySubSurveyActivityId(subSurveyActivityId: $subSurveyActivityId) {
      id
      userId
      subSurveyActivityId
      districtId
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      lastUpdated
      superVisorId
      blockCount
      user {
        id
        name
        email
      }
      subSurveyActivity {
        id
        name
      }
      district {
        id
        name
        city
      }
    }
  }
`;
