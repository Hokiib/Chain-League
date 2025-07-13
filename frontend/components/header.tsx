"use client"

import { Button } from "@/components/ui/button"
import { Crown, Coins, Gift, Bell, LogOut, User } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import ChzBalanceDisplay from "./ChzBalanceDisplay"
import Image from "next/image"

interface HeaderProps {
  chzBalance: number
}

export default function Header({ chzBalance }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <div className="sticky top-0 z-20 bg-gray-950 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <div className="w-16 h-16 flex items-center justify-center">
            <img src="/logo.png" alt="Chain League" className="w-full h-full object-contain rounded-xl" />
          </div>
        </div>

        {/* User Info + CHZ + Icons */}
        <div className="flex items-center space-x-3">
          {/* Informations utilisateur */}
          {user && (
            <div className="flex items-center space-x-2 bg-gray-800 rounded-full px-3 py-1">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                <User className="h-3 w-3 text-white" />
              </div>
              <span className="text-white text-sm font-medium">{user.username}</span>
            </div>
          )}

          {/* Solde CHZ avec statut réseau */}
          <ChzBalanceDisplay chzBalance={chzBalance} />

          {/* Boutons d'action */}
          <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-gray-400 hover:text-white">
            <Gift className="h-6 w-6" />
          </Button>
          <Button size="sm" variant="ghost" className="w-10 h-10 p-0 text-gray-400 hover:text-white">
            <Bell className="h-6 w-6" />
          </Button>

          {/* Bouton de déconnexion */}
          {user && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="w-10 h-10 p-0 text-gray-400 hover:text-red-400"
              onClick={logout}
              title="Se déconnecter"
            >
              <LogOut className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
