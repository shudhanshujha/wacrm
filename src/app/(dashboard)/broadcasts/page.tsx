import { cookies } from "next/headers"
import BroadcastsContent from "./broadcasts-content"

export const dynamic = "force-dynamic"

export default async function BroadcastsPage() {
  await cookies() 
  return <BroadcastsContent />
}
