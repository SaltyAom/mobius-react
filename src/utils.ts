export const gqlTypes = ['String', 'Int', 'Float', 'ID']

type Param = string | Record<string, unknown>
export type SchemaModel = {
    Query: Record<string, Record<string, string | [string, string]>>
    Mutation: Record<string, Record<string, string | [string, string]>>
    Subscription: Record<string, Record<string, string | [string, string]>>
    Scalars: string[]
} & {
    [type in string]: string
}

export const addSuffix = (input: any): Record<string, unknown> => {
    if (typeof input !== 'object' || input === null) return input

    if (Array.isArray(input))
        return input.map((item) =>
            typeof item !== 'object' ? `$${item}` : addSuffix(item)
        ) as any

    const newObj: any = {}

    for (const key in input) {
        if (!(key in input)) continue

        if (typeof input[key] !== 'object') newObj['$' + key] = input[key]
        else newObj[key] = addSuffix(input[key])
    }

    return newObj
}

export type AddSuffix<T> = {
    [K in keyof T as NonNullable<T[K]> extends Record<string, unknown>
        ? K
        : NonNullable<T[K]> extends Function
        ? K
        : NonNullable<T[K]> extends readonly unknown[]
        ? K
        : `$${string & K}`]: T[K] extends (...args: any[]) => infer R
        ? (...args: Parameters<T[K]>) => AddSuffix<R>
        : NonNullable<T[K]> extends Record<string, unknown>
        ? AddSuffix<T[K]>
        : NonNullable<T[K]> extends readonly unknown[]
        ? AddSuffix<NonNullable<T[K]>[number]>[]
        : T[K]
}

const mapComment = /#[^\n\r]*(\r?\n|$)|"""\s*([^]*?)\s*"""/g
const removeComment = (schema: string) =>
    schema.replace(mapComment, (match, singleLineComment, multiLineComment) => {
        if (singleLineComment) return ''
        if (multiLineComment)
            return multiLineComment
                .split('\n')
                .map(() => '')
                .join('\n')

        return match
    })

const mapObjectType = /(?:type|input|interface)\s+(\w+)\s*{([^]*?)}/g
const mapObjectTypes = (schema: string) => {
    const types: Record<
        string,
        Record<string, string | [Record<string, string>, string]>
    > = {}

    let match
    while ((match = mapObjectType.exec(schema)) !== null)
        types[match[1]] = mapFieldsAndFunctions(match[2])

    return types
}

const fieldDecorators = /(?:\[|\]|\!)/g
const mapField = /\b(\w+)(?![^(]*\)):(.*)(!|\n| )/g
const mapFunctionField = /(\w+)\(\s*([\s\S]*?)\s*\):(.*)(!|\n| )/g
const mapFieldsAndFunctions = (schema: string) => {
    let fields: Record<string, string | [Record<string, string>, string]> = {}

    schema = schema.replace(/([|])/g, '')

    let match
    while ((match = mapField.exec(schema)) !== null)
        fields[match[1].trim()] = match[2].replace(fieldDecorators, '').trim()

    while ((match = mapFunctionField.exec(schema)) !== null) {
        const key = match[1].trim()
        fields[key] = [
            mapFields(match[2], fields[key] as any as Record<string, string>),
            match[3].replace(fieldDecorators, '').trim()
        ]
    }

    return fields
}

const mapFields = (schema: string, fields: Record<string, string> = {}) => {
    let match
    while ((match = mapField.exec(schema)) !== null)
        fields[match[1].trim()] = match[2].replace(fieldDecorators, '').trim()

    return fields
}

const mapUnion = /union\s*(\w+)\s*:\s*(\w+(?:\s*\[\s*\])?)/g
const mapUnions = (schema: string, models: Record<string, unknown> = {}) => {
    let match
    while ((match = mapUnion.exec(schema)) !== null) {
        // Get only first type is fine because we want to know
        // if it's string or object
        const value = match[2].split('|')[0].trim()

        models[match[1].trim()] = models?.[value] ?? 'String'
    }

    return models
}

const mapEnum = /enum\s*(\w+)\s*=/g
const mapEnums = (schema: string, models: Record<string, unknown> = {}) => {
    let match
    while ((match = mapUnion.exec(schema)) !== null)
        models[match[1].trim()] = 'String'

    return models
}

const mapScalar = /scalar\s*(\w+)/g
const mapScalars = (schema: string) => {
    const scalars = []

    let match
    while ((match = mapUnion.exec(schema)) !== null) scalars.push(match[1])

    return scalars
}


export const createMap = (typeDefs?: string): SchemaModel | null => {
    if (!typeDefs) return null

    typeDefs = removeComment(typeDefs)

    let schema: SchemaModel = mapObjectTypes(typeDefs) as any

    schema = mapUnions(typeDefs, mapEnums(typeDefs, schema)) as any

    schema.Query ??= {}
    schema.Mutation ??= {}
    schema.Subscription ??= {}
    schema.Scalars = mapScalars(typeDefs)

    return schema
}

export const access = (schema: SchemaModel, params: Param[]) => {
    let parent: string = 'Query'
    let current = null

    const accessors = params.filter(
        (x) => typeof x === 'string' && typeof [][x as any] !== 'function'
    )

    for (const param of accessors) {
        current = schema[parent as any]?.[param as any]

        if(schema.Scalars.includes(current)) return "String"

        if (!current) return null

        // Transform gql functions represent as [params, type] to type
        if (Array.isArray(current)) current = current[1]

        parent = current
    }

    return current
}

// Test
// const typeDefs = /* GraphQL */ `
//     type MultipleNHResponse {
//         success: Boolean!
//         error: String
//         data: [Nhresponse!]!
//     }

//     type MultipleNHentaiResponse {
//         success: Boolean!
//         error: String
//         data: [Nhentai!]!
//     }

//     type Nhentai {
//         id: Int
//         mediaId: Int
//         title: NhentaiTitle!
//         images: NhentaiImages!
//         scanlator: String
//         uploadDate: Int
//         tags: [NhentaiTag!]!
//         numPages: Int
//         numFavorites: Int
//         comments(
//             from: Int
//             to: Int
//             batch: Int
//             batchBy: Int
//             orderBy: NhqlCommentOrder
//             channel: NhqlChannel! = HIFUMIN_FIRST
//         ): [NhentaiComment!]!
//         related(channel: NhqlChannel! = HIFUMIN_FIRST): [Nhentai!]!
//     }

//     type NhentaiComment {
//         id: Int!
//         galleryId: Int!
//         poster: NhentaiCommentPoster!
//         postDate: Int!
//         body: String!
//     }

//     type NhentaiCommentPoster {
//         id: Int!
//         username: String!
//         slug: String!
//         avatarUrl: String!
//         isSuperuser: Boolean!
//         isStaff: Boolean!
//     }

//     type NhentaiGroup {
//         result: [Nhentai!]!
//         numPages: Int
//         perPage: Int
//     }

//     type NhentaiImages {
//         pages: [NhentaiPage!]!
//         cover: NhentaiPage!
//         thumbnail: NhentaiPage!
//     }

//     type NhentaiPage {
//         t: String
//         w: Int
//         h: Int
//     }

//     """
//     nHentai Query

//     Same format as nHentai API
//     """
//     type NhentaiQuery {
//         """
//         Get nHentai by ID (6 digits code)
//         """
//         by(id: Int!, channel: NhqlChannel! = HIFUMIN_FIRST): Nhentai!

//         """
//         Get multiple nHentai by ID (6 digits code)

//         - IDs must be unique
//         - Maximum 25 IDs per batch
//         - Only available for HifuminFirst channel
//         """
//         multiple(id: [Int!]!): MultipleNHentaiResponse!

//         """
//         Search from nHentai
//         """
//         search(
//             with: String! = ""
//             page: Int! = 1
//             includes: [String!]! = []
//             excludes: [String!]! = []
//             channel: NhqlChannel! = HIFUMIN_FIRST
//         ): NhentaiGroup!
//     }

//     type NhentaiTag {
//         id: Int!
//         type: String!
//         name: String!
//         url: String!
//         count: Int!
//     }

//     type NhentaiTitle {
//         english: String
//         japanese: String
//         pretty: String
//     }

//     type Nhql {
//         id: Int!
//         title: NhqlTitle!
//         images: NhqlImages!
//         info: NhqlInfo!
//         metadata: NhqlMetadata!
//         comments(
//             from: Int
//             to: Int
//             batch: Int
//             batchBy: Int
//             orderBy: NhqlCommentOrder
//             channel: NhqlChannel! = HIFUMIN_FIRST
//             A: String
//         ): NhqlCommentResponse!
//         related(channel: NhqlChannel! = HIFUMIN_FIRST): [Nhql!]!
//     }

//     """
//     Specified source origin
//     """
//     enum NhqlChannel {
//         """
//         Strategy: Hifumin first then fallback to nHentai.
//         (DEFAULT)
//         """
//         HIFUMIN_FIRST

//         """
//         Hifumin mirror, updates every 12 hours with no rate limit
//         Best if data loss is not toleratable.
//         """
//         HIFUMIN

//         """
//         Use direct NHentai API, with rate limit and possibly maintain only 7 concurrent connections
//         Best for fresh new data but data loss is toleratable
//         """
//         NHENTAI
//     }

//     type NhqlComment {
//         id: Int!
//         user: NhqlUser!
//         created: Int!
//         comment: String!
//     }

//     enum NhqlCommentOrder {
//         """
//         Order by comment date by descending order. (default)
//         """
//         NEWEST

//         """
//         Order by comment date by ascending order
//         """
//         OLDEST
//     }

//     type NhqlCommentResponse {
//         total: Int!
//         data: [NhqlComment!]!
//     }

//     type NhqlImages {
//         pages: [NhqlPage!]!
//         cover: NhqlPage!
//     }

//     type NhqlInfo {
//         amount: Int!
//         favorite: Int!
//         upload: Int!
//         mediaId: Int!
//     }

//     type NhqlMetadata {
//         parodies: [NhqlTag!]!
//         characters: [NhqlTag!]!
//         groups: [NhqlTag!]!
//         categories: [NhqlTag!]!
//         artists: [NhqlTag!]!
//         tags: [NhqlTag!]!
//         language: String!
//     }

//     type NhqlPage {
//         link: String!
//         info: NhqlPageInfo!
//     }

//     type NhqlPageInfo {
//         type: String!
//         width: Int!
//         height: Int!
//     }

//     """
//     Nhql (nHentai API)

//     Easier formatted data, ready to used out of the box
//     """
//     type NhqlQuery {
//         """
//         Get nHentai by ID (6 digits code)
//         """
//         by(id: Int!, channel: NhqlChannel! = HIFUMIN_FIRST): Nhresponse!

//         """
//         Get multiple nHentai by ID (6 digits code)

//         - IDs must be unique
//         - Maximum 25 IDs per batch
//         - Only available for HifuminFirst channel
//         """
//         multiple(id: [Int!]!): MultipleNHResponse!

//         """
//         Search from nHentai
//         """
//         search(
//             with: String! = ""
//             page: Int! = 1
//             includes: [String!]! = []
//             excludes: [String!]! = []
//             channel: NhqlChannel! = HIFUMIN_FIRST
//         ): NhsearchResponse!
//     }

//     type NhqlTag {
//         name: String!
//         count: Int!
//         url: String!
//     }

//     type NhqlTitle {
//         display: String
//         english: String
//         japanese: String
//     }

//     type NhqlUser {
//         id: Int!
//         username: String!
//         slug: String!
//         avatar: String!
//     }

//     type Nhresponse {
//         success: Boolean!
//         error: String
//         data: Nhql
//     }

//     type NhsearchResponse {
//         success: Boolean!
//         error: String
//         total: Int!
//         data: [Nhql!]!
//     }

//     type Query {
//         nhentai: NhentaiQuery!
//         nhql: NhqlQuery!
//     }
// `

// console.log(createMap(typeDefs)!.NhqlImages)

// console.log(
//     access(createMap(typeDefs)!, ['nhql', 'by', 'data', 'images', 'pages'])
// )
