import { gql } from "@apollo/client";

export const SET_MONTHLY_STAFF_DOC_NUMBER_CONFIG = gql`
  mutation SetDocNumberConfig(
    $spkStartNumber: Int!
    $bastStartNumber: Int!
    $spkFormat: String!
    $bastFormat: String!
  ) {
    setDocNumberConfig(
      spkStartNumber: $spkStartNumber
      bastStartNumber: $bastStartNumber
      spkFormat: $spkFormat
      bastFormat: $bastFormat
    )
  }
`;