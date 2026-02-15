import { gql, useMutation } from "@apollo/client";

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateUserDto!) {
    updateProfile(input: $input) {
      id
      name
      email
      phone_number
      address
      job_name
      nip
      districtId
      villageId
      district {
        id
        name
        city
      }
      village {
        id
        name
      }
      primaryRole
      roles
    }
  }
`;
