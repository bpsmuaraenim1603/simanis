import { gql } from "@apollo/client";

export const UPLOAD_SURVEY_SAMPLE_PHOTO = gql`
  mutation UploadSurveySamplePhoto($sampleId: String!, $file: Upload!) {
    uploadSurveySamplePhoto(sampleId: $sampleId, file: $file)
  }
`;
