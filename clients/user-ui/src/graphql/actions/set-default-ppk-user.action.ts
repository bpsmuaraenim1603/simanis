import { gql } from "@apollo/client";

export const SET_DEFAULT_PPK_USER = gql`
  mutation SetDefaultPpkUser($userId: String!) {
    setDefaultPpkUser(userId: $userId)
  }
`;
