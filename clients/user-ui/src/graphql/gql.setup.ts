import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache,
  split,
} from "@apollo/client";
import { setContext } from '@apollo/client/link/context';
import { createUploadLink } from "apollo-upload-client";
import { getMainDefinition } from "@apollo/client/utilities";
import Cookies from "js-cookie";

const auth = setContext((operation, prev) => ({
  headers: {
    ...prev.headers,
    // TOKEN kalau ada:
    accesstoken: typeof window !== 'undefined' ? localStorage.getItem('access_token') ?? '' : '',
    refreshtoken: typeof window !== 'undefined' ? localStorage.getItem('refresh_token') ?? '' : '',
    // >>> KUNCI ANTI-CSRF UNTUK multipart:
    'apollo-require-preflight': 'true',
    // (opsional sekaligus) beri operation name:
    'x-apollo-operation-name': operation.operationName || 'unknown',
  },
}));

const userLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_USER_SERVER_URI, // 4001
}) as any;
const surveyLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_SURVEYACT_SERVER_URI, // 4002
}) as any;

// Split link berdasarkan nama mutation/query
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    if (
      definition.kind === "OperationDefinition" &&
      typeof definition.name?.value === "string"
    ) {
      return (
        definition.name.value.toLowerCase().includes("survey") ||
        definition.name.value.toLowerCase().includes("spj") ||
        definition.name.value.toLowerCase().includes("jobletter") ||
        definition.name.value.toLowerCase().includes("issue")
      );
    }
    return false; // fallback, selalu return boolean
  },
  surveyLink,
  userLink
);

// Auth middleware tetap bisa disisipkan
const authMiddleware = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: {
      accesstoken: Cookies.get("access_token"),
      refreshtoken: Cookies.get("refresh_token"),
    },
  });
  return forward(operation);
});

export const graphqlClient = new ApolloClient({
  link: authMiddleware.concat(splitLink),
  cache: new InMemoryCache(),
});
