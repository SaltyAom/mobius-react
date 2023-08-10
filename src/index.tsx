import { DESTRUCTION } from 'dns'
import Mobius, { type CreateMobius } from 'graphql-mobius'
import React, {
    useState,
    useReducer,
    useRef,
    useMemo,
    useEffect,
    type Dispatch,
    type SetStateAction,
    type MutableRefObject
} from 'react'
import {
    AddSuffix,
    SchemaModel,
    access,
    addSuffix,
    createMap,
    gqlTypes
} from './utils'

type Timeout = ReturnType<typeof setTimeout>
type Param = string | Record<string, unknown>

type MobiusContext = {
    mobius: Mobius
    params: Param[]
    state: unknown
    update: Dispatch<SetStateAction<Record<string, unknown>>>
    dispatch(p?: Param[]): void
    ref: MutableRefObject<{
        t: Timer | null
        p: string[][]
        s: string[]
        d: Record<string, string>
    }>['current']
    schema: SchemaModel | null
}

const model = <></>

function deepMerge(
    obj1: Record<string, unknown>,
    obj2: Record<string, unknown>
) {
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj2

    const merged = { ...obj1 }

    for (const key in obj2) {
        if (obj2.hasOwnProperty(key)) {
            if (
                obj1.hasOwnProperty(key) &&
                typeof obj1[key] === 'object' &&
                typeof obj2[key] === 'object'
            ) {
                // @ts-ignore
                merged[key] = deepMerge(obj1[key], obj2[key])
            } else if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
                // @ts-ignore
                merged[key] = [...obj1[key], ...obj2[key]]
            } else {
                merged[key] = obj2[key]
            }
        }
    }

    return merged
}

const createMobiusProxy = (context: MobiusContext): any => {
    const { params, state, dispatch, ref, update, schema } = context

    return new Proxy(() => {}, {
        get(target, prop: string | typeof Symbol.toPrimitive) {
            if (prop === Symbol.toPrimitive) return undefined

            if (schema) {
                const type = access(schema, [...params, prop])

                const hasValue =
                    typeof state === 'object' &&
                    state?.[prop as keyof typeof state]

                if (hasValue && type === null) return null

                if (gqlTypes.includes(type)) {
                    if (hasValue) return state?.[prop as keyof typeof state]

                    dispatch([...params, prop])

                    return null
                }

                return createMobiusProxy({
                    ...context,
                    params: [...params, prop],
                    state:
                        typeof state === 'object' &&
                        state?.[prop as keyof typeof state]
                            ? typeof state?.[prop as keyof typeof state] ===
                              'function'
                                ? state
                                : state?.[prop as keyof typeof state]
                            : null
                })
            } else
                switch (prop[0]) {
                    case '$':
                        if (
                            typeof state === 'object' &&
                            state?.[prop as keyof typeof state]
                        )
                            return state[prop as keyof typeof state]

                        dispatch([...params, prop.slice(1)])

                        return null
                }

            return createMobiusProxy({
                ...context,
                params: [...params, prop],
                state:
                    typeof state === 'object' &&
                    state?.[prop as keyof typeof state]
                        ? typeof state?.[prop as keyof typeof state] ===
                          'function'
                            ? state
                            : state?.[prop as keyof typeof state]
                        : null
            })
        },
        apply(target, prop, [arg]: [Function | Record<string, unknown>]) {
            if (typeof arg === 'function') {
                if (Array.isArray(state)) {
                    const result = state.map((state) =>
                        createMobiusProxy({
                            ...context,
                            state
                        })
                    )

                    return (
                        result[params.at(-1) as keyof typeof params] as Function
                    )(arg)
                }

                return arg(
                    createMobiusProxy({
                        ...context,
                        params: params.slice(0, -1)
                    })
                )
            }

            const key = params.join('.')
            if (ref.d[key] && ref.d[key] !== JSON.stringify(arg ?? {}))
                update({})

            ref.d[key] = JSON.stringify(arg ?? {})

            return createMobiusProxy({
                ...context,
                params: [...params, arg]
            })
        }
    })
}

function nest(initial: Record<string, unknown>, arr: Param[]) {
    let current = initial

    for (let i = 0; i < arr.length; i++) {
        const key = arr[i]
        const isLast = i === arr.length - 1

        if (typeof key === 'object') {
            current.where = key
            current.select = current?.select ?? {}
            current = current.select as Record<string, unknown>
            continue
        }

        current[key] ??= isLast ? true : {}

        current = current[key] as Record<string, unknown>
    }

    return initial
}

type IsTemplateLiteral<T extends string> = T extends `${string}${infer R}`
    ? true
    : false

export const createMobius = <
    R extends string | undefined = undefined,
    Scalars extends Record<string, unknown> = {},
    T extends string = string
>(
    config?: Mobius<T>['config']
): {
    mobius: Mobius<T, Scalars>
    useMobius: () => CreateMobius<R extends string ? R : T> extends {
        Query: infer Query
        Mutation: infer Mutation
    }
        ? R extends T
            ? AddSuffix<Query>
            : Query
        : {}
} => {
    const mobius = new Mobius<any>(config)

    return {
        mobius: mobius as any,
        useMobius: () => {
            const [state, update] = useState({} as Record<string, unknown>)
            const { current: ref } = useRef({
                t: null as Timeout | null,
                // params
                p: [] as string[][],
                // stringified params
                s: [] as string[],
                // deps
                d: {} as Record<string, string>
            })

            // useEffect(() => {
            //     return () => {
            //         if (ref.t) clearTimeout(ref.t)
            //     }
            // }, [])

            const dispatch = (params: string[]) => {
                if (!ref.t) ref.t = setTimeout(fetch)

                const string = params.toString()

                if (!ref.s.some((x) => x === string)) {
                    ref.p.push(params)
                    ref.s.push(string)
                }
            }

            const fetch = () => {
                let query: Record<string, unknown> = {}
                for (const params of ref.p) query = nest(query, params)

                mobius
                    .query(query)
                    .then((x) => {
                        if (x)
                            update(
                                deepMerge(
                                    state,
                                    config?.typeDefs ? x : addSuffix(x)
                                )
                            ) as any
                    })
                    .finally(() => {
                        ref.t = null
                        ref.p = []
                        ref.s = []
                    })
            }

            return createMobiusProxy({
                mobius,
                params: [],
                state,
                update,
                dispatch,
                ref,
                schema: createMap(config?.typeDefs)
            }) as any
        }
    }
}
