import { gql } from "@apollo/client";

export const GET_MITRA_BULANAN_EXPORT = gql`
  query GetMitraBulananExport($year: Int!, $month: Int) {
    getMitraBulananExport(year: $year, month: $month) {
      year
      month
      userId
      name
      job_name
      district
      city
      subsurveyactivity
      startDate
      endDate
      totalAssigned
      sampleType
      priceCompareUnit
      unitWorkPrice
      docsBill
      budgetCode
      limit_bill
      primaryRole
      chiefName
      dipa
      spkCode
      bastCode
      spkNumber
      bastNumber
    }
  }
`;
