"use client"

import { useState } from "react"

export function PartnerLogo() {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <span className="text-sm font-semibold text-gray-700">cIntelligence</span>
  }

  return (
    <img
      src="/partners/cintelligence-logo.png"
      alt="cIntelligence Partner"
      className="h-auto w-full max-w-[568px] object-contain"
      onError={() => setHasError(true)}
    />
  )
}