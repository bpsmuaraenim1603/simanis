import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_SUBSURVEY_ID = gql`
  query UserProgressBySubSurveyActivityId($subSurveyActivityId: String!) {
    userProgressBySubSurveyActivityId(
      subSurveyActivityId: $subSurveyActivityId
    ) {
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
      travelBill
      superVisor {
        id
        name
        email
      }
      user {
        id
        name
        email
        limit_bill
      }
      subSurveyActivity {
        id
        name
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
        photoPath
        photoSignedUrl
      }
    }
  }
`;
