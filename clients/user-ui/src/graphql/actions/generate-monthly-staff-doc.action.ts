import { gql } from "@apollo/client";

export const GENERATE_MONTHLY_STAFF_DOC = gql`
  mutation GenerateMonthlyStaffDoc($input: GenerateMonthlyStaffDocInput!) {
    generateMonthlyStaffDoc(input: $input)
  }
`;
