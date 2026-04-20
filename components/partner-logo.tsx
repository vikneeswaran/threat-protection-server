"use client"

export function PartnerLogo() {
  return (
    <img
      src="/cintelligence-logo.png"
      alt="cIntelligence Partner"
      className="h-20 w-auto object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = "/cintelligence-logo-white-text.jpg"
      }}
    />
  )
}