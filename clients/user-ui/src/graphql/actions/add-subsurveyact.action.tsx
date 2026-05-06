"use client"
import { gql } from "@apollo/client";

export const ADD_SUBSURVEY_ACTIVITY = gql`
mutation AddSubSurveyActivity($input: CreateSubSurveyActivityDTO!) {
  createSubSurveyActivity(input: $input) {
    id
    name
    slug
    surveyActivityId
    startDate
    endDate
    handoverMonth
    targetSample
    sampleType
    priceCompareUnit
    activityType
    budgetCode
    unitWorkPrice
  }
}
`;