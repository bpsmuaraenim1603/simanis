'use client'

import { graphqlClient } from '@/src/graphql/gql.setup'
import { ApolloProvider } from '@apollo/client'
import {HeroUIProvider} from '@heroui/react'
import { SessionProvider } from 'next-auth/react'
import {ThemeProvider as NextThemesProvider} from 'next-themes'

export function Providers({children}: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={graphqlClient}>
      <SessionProvider>
        <HeroUIProvider>
          <NextThemesProvider attribute='class'>
            {children}
          </NextThemesProvider>
        </HeroUIProvider>
      </SessionProvider>
    </ApolloProvider>
  )
}