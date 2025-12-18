import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_BY_SUBSURVEY_ID = gql`
  query UserProgressBySubSurveyActivityId($subSurveyActivityId: String!) {
    userProgressBySubSurveyActivityId(
      subSurveyActivityId: $subSurveyActivityId
    ) {
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
      villageName
      travelBill
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
      }
      samples {
        id
        nus
        identity
        cacahStatus
        approvalStatus
        geoLat
        geoLng
      }
    }
  }
`;
