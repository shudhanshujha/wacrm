import { Suspense } from "react"
import { cookies } from "next/headers"
import NewAutomationContent from "./new-automation-content"

export const dynamic = "force-dynamic"

export default async function NewAutomationPage() {
  // Force dynamic rendering by calling a server-only function
  await cookies() 

  return (
    <Suspense>
      <NewAutomationContent />
    </Suspense>
  )
}
