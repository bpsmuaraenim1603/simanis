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
      village_name
      job_name
      phone_number
      limit_bill
      updatedAt
    }
  }
`;