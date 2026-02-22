import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_ID = gql`
  query UserProgressById($userProgressId: String!) {
    userProgressById(userProgressId: $userProgressId) {
      id
      userId
      progressRole
      subSurveyActivityId
      districtId
      villageId
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      lastUpdated
      superVisorId
      blockCount
      docsBill
      user {
        id
        name
        email
        limit_bill
      }
      superVisor {
        id
        name
        email
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
