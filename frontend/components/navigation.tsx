"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, Play, Trophy, User, DollarSign, ShoppingBag } from "lucide-react"

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", icon: Home, label: "Accueil" },
    { href: "/game", icon: Play, label: "Jeu" },
    { href: "/bet", icon: DollarSign, label: "Paris" },
    { href: "/leaderboard", icon: Trophy, label: "Classement" },
    { href: "/shop", icon: ShoppingBag, label: "Boutique" },
    { href: "/profile", icon: User, label: "Profil" },
  ]

  return (
    <div className="nav-fixed bg-gray-950 border-t border-gray-800 pb-safe">
      <div className="grid grid-cols-6 nav-height px-1 sm:px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-0.5 sm:space-y-1 transition-colors p-1 ${
                isActive ? "text-purple-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
