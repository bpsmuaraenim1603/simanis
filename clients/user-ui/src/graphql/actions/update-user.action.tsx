import { gql, useMutation } from "@apollo/client";

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateUserDto!) {
    updateProfile(input: $input) {
      id
      name
      email
      phone_number
      address
      primaryRole
      roles
    }
  }
`;
