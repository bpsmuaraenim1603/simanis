"use client"

import {gql, DocumentNode} from '@apollo/client';

export const REGISTER_USER: DocumentNode = gql`
mutation RegisterUser(
    $name: String!
    $email: String!
    $password: String!
    $phone: String!
    $address: String!
    $job_name: String!
    $village_name: String!
    $signupCode: String!
) {
    (registerDto: {
        name: $name,
        email: $email,
        password: $password,
        phone_number: $phone,
        address: $address,
        job_name: $job_name,
        village_name: $village_name,
        signupCode: $signupCode
    }) {
        activation_token
    }
}
`