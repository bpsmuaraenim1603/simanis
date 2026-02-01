import { gql } from "@apollo/client";

export const GENERATE_MONTHLY_STAFF_DOCS = gql`
  mutation GenerateMonthlyStaffDocs($input: GenerateMonthlyStaffDocsInput!) {
    generateMonthlyStaffDocs(input: $input) {
      spkUrl
      bastUrl
      nomorSPK
      nomorBAST
    }
  }
`;
