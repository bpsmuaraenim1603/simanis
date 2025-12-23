import { gql } from "@apollo/client";

// Nama operation mengandung kata "survey" supaya otomatis lewat surveyLink (4002)
export const UPLOAD_SURVEY_SAMPLE_PHOTO = gql`
  mutation UploadSurveySamplePhoto($sampleId: String!, $file: Upload!) {
    uploadSurveySamplePhoto(sampleId: $sampleId, file: $file)
  }
`;
