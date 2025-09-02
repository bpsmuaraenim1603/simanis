import { gql, useMutation } from "@apollo/client";

export const UPDATE_ROLE = gql`
  mutation EditUserRole($userId: String!, $updateRole: UpdateRoleDto!) {
    editUserRole(userId: $userId, updateRole: $updateRole) {
      id
      name
      role
      email
    }
  }
`;
