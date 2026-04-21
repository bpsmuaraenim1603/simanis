import { gql } from "@apollo/client";

export const SET_MONTHLY_STAFF_DOC_NUMBER_CONFIG = gql`
  mutation SetDocNumberConfig(
    $spkStartNumber: Int!
    $bastStartNumber: Int!
  ) {
    setDocNumberConfig(
      spkStartNumber: $spkStartNumber
      bastStartNumber: $bastStartNumber
    )
  }
`;