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
      phone_number
      limit_bill
      updatedAt
    }
  }
`;