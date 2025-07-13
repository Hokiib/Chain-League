"use client"

import Image from "next/image"

interface TeamLogoProps {
  logo?: string
  name?: string
  size?: number
  className?: string
}

export default function TeamLogo({ logo, name, size = 24, className = "" }: TeamLogoProps) {
  // Agrandir spécifiquement le logo d'Inter Miami
  const adjustedSize = name === "INTER MIAMI" ? size * 1.3 : size;
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Image 
        src={logo || "/placeholder.svg"} 
        alt={name || "Team logo"} 
        width={adjustedSize} 
        height={adjustedSize} 
        className="object-contain rounded-lg" 
      />
    </div>
  )
} 