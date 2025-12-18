import { gql } from "@apollo/client";

export const UPDATE_USER_PROGRESS = gql`
  mutation UpdateUserSurveyProgress($input: UpdateUserProgressDTO!) {
    updateUserSurveyProgress(input: $input) {
      id
      userId
      subSurveyActivityId
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      samples {
        id
        nus
        identity
        cacahStatus
        approvalStatus
        geoLat
        geoLng
        geoCapturedAt
      }
      lastUpdated
    }
  }
`;
