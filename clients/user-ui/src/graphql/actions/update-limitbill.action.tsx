import { gql, useMutation } from "@apollo/client";

export const UPDATE_BILL_LIMIT = gql`
  mutation EditBillLimit($userId: String!, $updateBillLimit: UpdateBillLimitDto!) {
    updateBillLimit(userId: $userId, updateBillLimit: $updateBillLimit) {
      id
      name
      limit_bill
      email
    }
  }
`;
