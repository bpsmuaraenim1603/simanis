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
    $nip: String
    $districtId: String!
    $villageId: String!
    $signupCode: String!
) {
    register(registerDto: {
        name: $name,
        email: $email,
        password: $password,
        phone_number: $phone,
        address: $address,
        job_name: $job_name,
        nip: $nip,
        districtId: $districtId,
        villageId: $villageId,
        signupCode: $signupCode
    }) {
        activation_token
    }
}
`