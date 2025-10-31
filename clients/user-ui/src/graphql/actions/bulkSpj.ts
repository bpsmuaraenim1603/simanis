import { gql } from '@apollo/client';

export const BULK_SUBMIT_SPJ_HONOR = gql`
  mutation BulkSubmitSpjHonor($file: Upload!, $defaults: BulkSpjDefaultsInput!) {
    bulkSubmitSpjHonor(file: $file, defaults: $defaults) {
      batchCode
      inserted
      skippedDuplicates
      evidenceUrl
      errors { rowIndex message }
    }
  }
`;
