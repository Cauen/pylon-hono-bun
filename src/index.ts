import {app} from '@getcronit/pylon'

export const graphql = {
  Query: {
    hello: () => {
      return 'Hello, world!'
    },
    withArgs: (_, {arg}: {arg: string}) => {
      return `Hello, ${arg}!`
    }
  },
  Mutation: {}
}

app.get('/', context => context.json({status: 'ok'}))
app.get('/health', context => context.json({status: 'ok'}))

export default app
