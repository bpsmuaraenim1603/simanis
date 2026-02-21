import { gql } from '@apollo/client';

export const GET_ALL_SAMPLE_TYPES = gql`
  query AllSurveySampleTypes {
    allSurveySampleTypes {
      id
      name
    }
  }
`;

export const CREATE_SAMPLE_TYPE = gql`
  mutation CreateSurveySampleType($input: CreateSampleTypeDTO!) {
    createSurveySampleType(input: $input) {
      id
      name
    }
  }
`;