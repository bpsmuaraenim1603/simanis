import { gql } from "@apollo/client";

export const GET_MONTHLY_STAFF_DOC_NUMBER_CONFIG = gql`
  query MonthlyStaffDocNumberConfig {
    monthlyStaffDocNumberConfig {
      spkStartNumber
      bastStartNumber
      currentSpkNumber
      currentBastNumber
      nextSpkNumber
      nextBastNumber
    }
  }
`;