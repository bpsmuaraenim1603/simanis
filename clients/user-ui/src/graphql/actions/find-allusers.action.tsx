import { gql, useQuery } from "@apollo/client";

export const GET_ALL_USERS = gql`
  query GetUsers {
    getUsers {
      id
      name
      email
      password
      role
      address
      phone_number
      limit_bill
      updatedAt
    }
  }
`;