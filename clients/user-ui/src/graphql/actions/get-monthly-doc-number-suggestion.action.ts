import { gql } from "@apollo/client";

export const GET_MONTHLY_DOC_NUMBER_SUGGESTION = gql`
  query MonthlyDocNumberSuggestion(
    $userId: ID!
    $month: Int!
    $year: Int!
  ) {
    monthlyDocNumberSuggestion(userId: $userId, month: $month, year: $year) {
      nomorSPK
      nomorBAST
    }
  }
`;