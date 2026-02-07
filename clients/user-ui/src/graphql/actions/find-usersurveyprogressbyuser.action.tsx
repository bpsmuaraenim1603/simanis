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
      docsBill
      lastUpdated
      user {
        id
        name
        limit_bill
      }
      superVisorId
      superVisor {
        id
        name
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
      samples {
        id
        nus
        identity
        cacahStatus
        approvalStatus
        geoLat
        geoLng
        geoCapturedAt
        photoPath
        photoCapturedAt
        photoSignedUrl
      }
    }
  }
`;
