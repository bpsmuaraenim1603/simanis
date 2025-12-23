import { gql } from "@apollo/client";

export const PATCH_USER_SAMPLES = gql`
  mutation PatchUserSamples($input: PatchUserSamplesDTO!) {
    patchUserSamples(input: $input) {
      id
      totalAssigned
      submitCount
      approvedCount
      rejectedCount
      samples {
        id
        nus
        identity
        cacahStatus
        approvalStatus
        geoLat
        geoLng
        geoCapturedAt
        photoPath
        photoCapturedAt
        photoSignedUrl
      }
    }
  }
`;
