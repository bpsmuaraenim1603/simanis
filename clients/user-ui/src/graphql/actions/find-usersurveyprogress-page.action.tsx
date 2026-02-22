import { gql } from "@apollo/client";

export const GET_USER_PROGRESS_PAGE_BY_SUBSURVEY_ID = gql`
  query UserProgressPageBySubSurveyActivityId(
    $subSurveyActivityId: String!
    $page: Int
    $pageSize: Int
    $progressRole: ProgressRole
    $search: String
    $superVisorId: String
  ) {
    userProgressPageBySubSurveyActivityId(
      subSurveyActivityId: $subSurveyActivityId
      page: $page
      pageSize: $pageSize
      progressRole: $progressRole
      search: $search
      superVisorId: $superVisorId
    ) {
      total
      page
      pageSize
      items {
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
        superVisor {
          id
          name
          email
          limit_bill
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
      }
    }
  }
`;
