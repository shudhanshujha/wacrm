import { cookies } from "next/headers"
import AutomationsContent from "./automations-content"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
  await cookies() 
  return <AutomationsContent />
}
