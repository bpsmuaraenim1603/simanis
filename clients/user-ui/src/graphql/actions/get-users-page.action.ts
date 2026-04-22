import { gql } from "@apollo/client";

export const GET_USERS_PAGE = gql`
  query GetUsersPage($page: Int!, $pageSize: Int!, $search: String) {
    getUsersPage(page: $page, pageSize: $pageSize, search: $search) {
      total
      items {
        id
        name
        email
        primaryRole
        roles
        address
        villageId
        districtId
        district {
          id
          name
        }
        village {
          id
          name
        }
        nip
        job_name
        phone_number
        limit_bill
        updatedAt
      }
    }
  }
`;
