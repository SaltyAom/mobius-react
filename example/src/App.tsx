import { useState } from 'react'
import { useMobius } from './hooks'

export default function Page() {
    const api = useMobius()
    const [id, updateId] = useState(177013)

    const { data } = api.nhql.by({ id })

    return (
        <main className="flex flex-col justify-center w-full max-w-sm min-h-screen mx-auto py-8">
            <input
                className="mb-2"
                type="number"
                defaultValue={id}
                onBlur={(event) => {
                    updateId(event.target.valueAsNumber || 1)
                }}
            />

            <h1 className="text-3xl mb-2">{data?.title.display}</h1>
            <p>{data?.info.amount} pages</p>
            <p>{data?.info.favorite} favorites</p>

            <img src={data?.images.cover.link} />

            <ul>
                {data?.images.pages.map(({ link, info: { width, height } }) => (
                    <img
                        className="w-full h-full bg-gray-100"
                        key={link}
                        src={link}
                        loading="lazy"
                        style={{
                            aspectRatio: width / height
                        }}
                    />
                ))}
            </ul>
        </main>
    )
}
