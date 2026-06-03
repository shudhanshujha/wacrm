import { Suspense } from "react"
import { cookies } from "next/headers"
import NewBroadcastContent from "./new-broadcast-content"

export const dynamic = "force-dynamic"

export default async function NewBroadcastPage() {
  await cookies() 

  return (
    <Suspense>
      <NewBroadcastContent />
    </Suspense>
  )
}
