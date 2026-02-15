import { gql } from "@apollo/client";

export const PPK_OPTIONS = gql`
  query PpkOptions {
    ppkOptions {
      id
      name
      nip
      primaryRole
    }
  }
`;
