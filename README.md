# React (GraphQL) Mobius
[GraphQL Mobius](https://github.com/SaltyAom/mobius) binding for React

GraphQL to TypeScript type, **no code gen** with ith Prisma-like query syntax, fully type-safe.

**Written purely in TypeScript type.**


Brought to you by [ElysiaJS](https://elysiajs.com)

![mobius](https://github.com/SaltyAom/mobius/assets/35027979/0bb3291e-49f2-45da-9bcf-3e283ec3cc4d)

---

### Experimental Library: Do not use on production

## Why
Extending the vision of Mobius, we want to extends GraphQL Developer Experience to its fullest, and with React binding for Mobius, we change the way you write GraphQL, is that you don't want GraphQL at all.

Everything is an object, and function, we hide the GraphQL abstraction entirely, so you can focus writing your application.

## How it works
We extends [GraphQL Mobius](https://github.com/SaltyAom/mobius) which allows us to parse GraphQL schema to TypeScript type entirely in TypeScript type.

React Mobius use Proxy recursively to collect accessed property, and turns it into GraphQL Query and query via Mobius while providing full type safety experience from Mobius, creating an illusion of object.

However, as Proxy is recursively used and there's no way to detect the last used property of the proxy, we introduced a ($) prefix to unwrap the proxy into primitive data, if you have better approach, feels free to open the issue and let us know.

## Prerequisted
1. TypeScript > 5.0
2. Set `strict` to true in **tsconfig.json**

## Getting Start
1. Define a GraphQL Schema in string **(must be const)**
2. Cast schema to type using `typeof` (or pass it as literal params in constructor)

```tsx
import { createMobius } from '@graphql-mobius/react'

const typeDefs = `
    type A {
        A: String!
        B: String!
    }

    type Query {
        hello(word: String!): A!
    }
`

export const { useMobius } = createMobius<typeof typeDefs>({
    url: 'https://api.saltyaom.com/graphql'
})

const page = () => {
    const api = useMobius()

    return (
        <main>
            <h1>{api.hello({ word: "World" }).A}</h1>
        </main>
    )
}
```
