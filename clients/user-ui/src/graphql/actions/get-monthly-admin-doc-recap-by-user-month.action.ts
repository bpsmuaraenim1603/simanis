import { gql } from "@apollo/client";

export const GET_MONTHLY_ADMIN_DOC_RECAP_BY_USER_MONTH = gql`
  query MonthlyAdminDocRecapByUserMonth(
    $userId: String!
    $year: Int!
    $month: Int!
  ) {
    monthlyAdminDocRecapByUserMonth(
      userId: $userId
      year: $year
      month: $month
    ) {
      id
      userId
      year
      month
      spkNumber
      bastNumber
      ppkUserId
      ppkName
      ppkNip
      ppkUser {
        id
        name
        nip
      }
    }
  }
`;
