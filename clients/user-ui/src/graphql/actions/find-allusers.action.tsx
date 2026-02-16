import { gql, useQuery } from "@apollo/client";

export const GET_ALL_USERS = gql`
  query GetUsers {
    getUsers {
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
`;