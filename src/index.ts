import {app} from '@getcronit/pylon'

import {searchBooks} from './books'

export const graphql = {
  Query: {
    hello: () => {
      return 'Hello, world!'
    },
    withArgs: (arg: string) => {
      return `Hello, ${arg}!`
    },
    searchBooks
  },
  Mutation: {}
}

app.get('/', context => context.json({status: 'ok'}))
app.get('/health', context => context.json({status: 'ok'}))

export default app
