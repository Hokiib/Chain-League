"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import { useAuth } from "@/hooks/useAuth"
import { TEAMS } from "@/lib/types"
import { Crown, Star, Trophy, Target, Zap, Settings, Edit, Bell, Loader2, LogOut, ShoppingBag, Users, Coins } from "lucide-react"
import TeamLogo from "@/components/team-logo"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const { isAuthenticated, loading, user, logout, chzBalance } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentPlayer] = useState({
    id: "player1",
    name: user?.username || "Joueur",
    team: user?.teamId || "psg",
    chzBalance: chzBalance || user?.chzBalance || 0,
    level: user?.level || 12,
    xp: user?.xp || 2340,
    joinDate: new Date("2024-01-15"),
    stats: {
      totalGames: 47,
      wins: 23,
      territories: 156,
      attacks: 89,
      defenses: 67,
      specialsUsed: 34,
      timePlayedHours: 127,
    },
    badges: [
      {
        id: "first_win",
        name: "Première Victoire",
        description: "Gagner votre premier match",
        rarity: "common",
        effect: "+5% XP",
      },
      {
        id: "conqueror",
        name: "Conquérant",
        description: "Capturer 50 territoires",
        rarity: "rare",
        effect: "+10% dégâts d'attaque",
      },
      {
        id: "defender",
        name: "Défenseur",
        description: "Renforcer 100 zones",
        rarity: "epic",
        effect: "+15% HP des bases",
      },
      {
        id: "vip_psg",
        name: "VIP PSG",
        description: "Abonné PSG depuis 3 mois",
        rarity: "legendary",
        effect: "Cooldown -20%",
      },
    ],
  })

  const handleEditProfile = () => {
    toast({
      title: "Modification du profil",
      description: "Fonction en développement...",
    });
  };

  const handleChangeTeam = () => {
    toast({
      title: "Changement d'équipe",
      description: "Sélectionnez votre nouvelle équipe favorite !",
    });
  };

  const handleSettings = () => {
    toast({
      title: "Paramètres",
      description: "Accès aux paramètres du compte...",
    });
  };

  const handleNotifications = () => {
    toast({
      title: "Notifications",
      description: "Gérez vos préférences de notifications...",
    });
  };

  const handleSubscriptions = () => {
    toast({
      title: "Abonnements",
      description: "Gérez vos abonnements VIP...",
    });
  };

  const handleGoToShop = () => {
    router.push('/shop');
  };

  // Si en cours de chargement, afficher un loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher un message mais ne pas rediriger
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
        <Header chzBalance={0} />
        <div className="px-4 py-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-white mb-2">Profil</h1>
            <p className="text-gray-400">Connectez-vous pour voir votre profil</p>
            <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-6 max-w-md mx-auto">
              <p className="text-gray-300 mb-4">Vous devez être connecté pour accéder à votre profil.</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Se connecter
              </Button>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  const getCurrentTeam = () => TEAMS.find((t) => t.id === currentPlayer.team)

  const winRate = Math.round((currentPlayer.stats.wins / currentPlayer.stats.totalGames) * 100)
  const xpToNextLevel = 1000
  const currentLevelXp = currentPlayer.xp % 1000

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-600"
      case "rare":
        return "bg-blue-600"
      case "epic":
        return "bg-purple-600"
      case "legendary":
        return "bg-yellow-600"
      default:
        return "bg-gray-600"
    }
  }

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "border-gray-500"
      case "rare":
        return "border-blue-500"
      case "epic":
        return "border-purple-500"
      case "legendary":
        return "border-yellow-500"
      default:
        return "border-gray-500"
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={chzBalance || currentPlayer.chzBalance} />

      <div className="px-4 py-6 space-y-6">
        {/* Profil Header */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl flex items-center justify-center">
                <Crown className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{currentPlayer.name}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <TeamLogo logo={getCurrentTeam()?.logo} name={getCurrentTeam()?.name} size={24} />
                  <span className="text-gray-400">{getCurrentTeam()?.name}</span>
                  <Badge className="bg-green-600 text-white">VIP</Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleEditProfile}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 rounded-xl bg-transparent"
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>

          {/* Niveau et XP */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Niveau {currentPlayer.level}</span>
              <span className="text-sm text-gray-400">
                {currentLevelXp}/{xpToNextLevel} XP
              </span>
            </div>
            <Progress value={(currentLevelXp / xpToNextLevel) * 100} className="h-3" />
          </div>
        </div>

        {/* Statistiques */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Statistiques</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-green-400">{currentPlayer.stats.wins}</div>
              <div className="text-sm text-gray-400">Victoires</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-blue-400">{winRate}%</div>
              <div className="text-sm text-gray-400">Taux de victoire</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-purple-400">{currentPlayer.stats.territories}</div>
              <div className="text-sm text-gray-400">Territoires capturés</div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <div className="text-3xl font-bold text-yellow-400">{currentPlayer.stats.timePlayedHours}h</div>
              <div className="text-sm text-gray-400">Temps de jeu</div>
            </div>
          </div>

          {/* Stats détaillées */}
          <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Détails des performances</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-red-400" />
                  <span className="text-white">Attaques réussies</span>
                </div>
                <span className="font-bold text-white">{currentPlayer.stats.attacks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="h-5 w-5 text-blue-400" />
                  <span className="text-white">Défenses réussies</span>
                </div>
                <span className="font-bold text-white">{currentPlayer.stats.defenses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-purple-400" />
                  <span className="text-white">Actions spéciales</span>
                </div>
                <span className="font-bold text-white">{currentPlayer.stats.specialsUsed}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <span className="text-white">Parties jouées</span>
                </div>
                <span className="font-bold text-white">{currentPlayer.stats.totalGames}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Badges</h2>
            <Badge className="bg-purple-600 text-white">{currentPlayer.badges.length} badges</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {currentPlayer.badges.map((badge) => (
              <div key={badge.id} className={`bg-gray-900 rounded-2xl border-2 ${getRarityBorder(badge.rarity)} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-12 h-12 ${getRarityColor(badge.rarity)} rounded-xl flex items-center justify-center`}
                  >
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <Badge className={`${getRarityColor(badge.rarity)} text-white text-xs`}>
                    {badge.rarity.toUpperCase()}
                  </Badge>
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{badge.name}</h3>
                <p className="text-xs text-gray-400 mb-2">{badge.description}</p>
                <div className="bg-gray-800 rounded-lg p-2">
                  <span className="text-xs text-green-400 font-medium">{badge.effect}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mon équipe */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Mon équipe</h3>
            <Button
              variant="outline"
              onClick={handleChangeTeam}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 rounded-xl text-sm bg-transparent"
            >
              Changer d'équipe
            </Button>
          </div>
          <div className="flex items-center space-x-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2"
              style={{ backgroundColor: `${getCurrentTeam()?.color}20`, borderColor: `${getCurrentTeam()?.color}50` }}
            >
              <TeamLogo logo={getCurrentTeam()?.logo} name={getCurrentTeam()?.name} size={32} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white text-xl">{getCurrentTeam()?.name}</h4>
              <p className="text-gray-400">{getCurrentTeam()?.subscribers.toLocaleString()} abonnés</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className="bg-green-600 text-white text-xs">Abonné VIP</Badge>
                <span className="text-xs text-gray-400">Depuis {currentPlayer.joinDate.toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Solde CHZ */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Solde CHZ</h3>
            <Button
              variant="outline"
              onClick={handleGoToShop}
              className="border-purple-600 text-purple-300 hover:bg-purple-900/20 rounded-xl text-sm bg-transparent"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Boutique
            </Button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
              <Coins className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-3xl font-bold text-white">
                {(chzBalance || currentPlayer.chzBalance).toLocaleString()} CHZ
              </div>
              <p className="text-gray-400">Solde disponible</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className="bg-green-600 text-white text-xs">Testnet Chiliz</Badge>
                <span className="text-xs text-gray-400">Mis à jour automatiquement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={handleGoToShop}
              className="h-16 border-purple-600 text-purple-300 hover:bg-purple-900/20 rounded-xl bg-transparent flex flex-col items-center justify-center"
            >
              <ShoppingBag className="h-6 w-6 mb-1" />
              <span className="text-sm">Boutique</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/leaderboard')}
              className="h-16 border-yellow-600 text-yellow-300 hover:bg-yellow-900/20 rounded-xl bg-transparent flex flex-col items-center justify-center"
            >
              <Trophy className="h-6 w-6 mb-1" />
              <span className="text-sm">Classement</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/game')}
              className="h-16 border-green-600 text-green-300 hover:bg-green-900/20 rounded-xl bg-transparent flex flex-col items-center justify-center"
            >
              <Target className="h-6 w-6 mb-1" />
              <span className="text-sm">Jouer</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/bet')}
              className="h-16 border-blue-600 text-blue-300 hover:bg-blue-900/20 rounded-xl bg-transparent flex flex-col items-center justify-center"
            >
              <Zap className="h-6 w-6 mb-1" />
              <span className="text-sm">Paris</span>
            </Button>
          </div>
        </div>

        {/* Paramètres */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Paramètres</h3>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleSettings}
              className="w-full justify-start border-gray-700 text-gray-300 hover:bg-gray-800 h-12 rounded-xl bg-transparent"
            >
              <Settings className="h-5 w-5 mr-3" />
              Paramètres du compte
            </Button>
            <Button
              variant="outline"
              onClick={handleNotifications}
              className="w-full justify-start border-gray-700 text-gray-300 hover:bg-gray-800 h-12 rounded-xl bg-transparent"
            >
              <Bell className="h-5 w-5 mr-3" />
              Notifications
            </Button>
            <Button
              variant="outline"
              onClick={handleSubscriptions}
              className="w-full justify-start border-gray-700 text-gray-300 hover:bg-gray-800 h-12 rounded-xl bg-transparent"
            >
              <Crown className="h-5 w-5 mr-3" />
              Abonnements
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              className="w-full justify-start border-red-700 text-red-300 hover:bg-red-900/20 h-12 rounded-xl bg-transparent"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
