"use client"

import {gql, DocumentNode} from '@apollo/client';

export const GET_USER: DocumentNode = gql`
query{
  getLoggedInUser{
    user{
      id
      name
      email
      phone_number
      address
      primaryRole
      roles
    }
    accessToken
    refreshToken
  }
}
`;