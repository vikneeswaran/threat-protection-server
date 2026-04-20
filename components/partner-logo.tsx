"use client"

import { useState } from "react"

export function PartnerLogo() {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <span className="text-sm font-semibold text-gray-700">cIntelligence</span>
  }

  return (
    <div className="rounded-md bg-[#1d1e20] px-6 py-3">
      <img
        src="/cintelligence-logo-white-text.jpg"
        alt="cIntelligence Partner"
        className="h-20 w-auto object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  )
}