import { gql } from "@apollo/client";

export const SET_MONTHLY_STAFF_DOC_NUMBER_CONFIG = gql`
  mutation SetMonthlyStaffDocNumberConfig(
    $spkStartNumber: Int!
    $bastStartNumber: Int!
  ) {
    setMonthlyStaffDocNumberConfig(
      spkStartNumber: $spkStartNumber
      bastStartNumber: $bastStartNumber
    )
  }
`;