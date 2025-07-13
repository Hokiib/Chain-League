"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import { useAuth } from "@/hooks/useAuth"
import { TEAMS } from "@/lib/types"
import { Crown, Trophy, Star, Users, Loader2, Gift, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import TeamLogo from "@/components/team-logo"

export default function LeaderboardPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentPlayer] = useState({
    chzBalance: 1247,
    team: "psg",
  })

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
            <h1 className="text-3xl font-bold text-white mb-2">Classements</h1>
            <p className="text-gray-400">Connectez-vous pour voir les classements</p>
            <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-6 max-w-md mx-auto">
              <p className="text-gray-300 mb-4">Vous devez être connecté pour voir les classements.</p>
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

  // Classements simulés
  const teamLeaderboard = TEAMS.map((team, index) => ({
    ...team,
    rank: index + 1,
    territories: Math.floor(Math.random() * 50) + 20,
    totalHp: Math.floor(Math.random() * 200) + 100,
    activePlayers: Math.floor(Math.random() * 500) + 100,
    wins: Math.floor(Math.random() * 20) + 5,
  })).sort((a, b) => b.territories - a.territories)

  const playerLeaderboard = Array.from({ length: 20 }, (_, index) => ({
    id: `player${index + 1}`,
    name: `Joueur${index + 1}`,
    team: TEAMS[Math.floor(Math.random() * TEAMS.length)].id,
    level: Math.floor(Math.random() * 30) + 10,
    xp: Math.floor(Math.random() * 10000) + 5000,
    wins: Math.floor(Math.random() * 50) + 10,
    territories: Math.floor(Math.random() * 100) + 20,
    rank: index + 1,
  }))

  const getTeamById = (id: string) => TEAMS.find((t) => t.id === id)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={currentPlayer.chzBalance} />

      <div className="px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Classements</h1>
          <p className="text-gray-400">Découvrez les meilleurs joueurs et équipes</p>
        </div>

        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900 rounded-2xl h-14 mb-6">
            <TabsTrigger
              value="teams"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold"
            >
              <Trophy className="h-5 w-5 mr-2" />
              Équipes
            </TabsTrigger>
            <TabsTrigger
              value="players"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold"
            >
              <Star className="h-5 w-5 mr-2" />
              Joueurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-4">
            {/* Podium */}
            <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-6 text-center">🏆 Podium des Équipes</h2>
              <div className="flex items-end justify-center space-x-4">
                {/* 2ème place */}
                <div className="text-center">
                  <div className="w-16 h-20 bg-gray-400 rounded-t-2xl flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-2 mb-2"
                    style={{
                      backgroundColor: `${teamLeaderboard[1]?.color}20`,
                      borderColor: `${teamLeaderboard[1]?.color}50`,
                    }}
                  >
                    <TeamLogo logo={teamLeaderboard[1]?.logo} name={teamLeaderboard[1]?.name} size={24} />
                  </div>
                  <div className="text-sm font-bold text-white">{teamLeaderboard[1]?.name}</div>
                  <div className="text-xs text-gray-400">{teamLeaderboard[1]?.territories} zones</div>
                </div>

                {/* 1ère place */}
                <div className="text-center">
                  <div className="w-20 h-24 bg-yellow-500 rounded-t-2xl flex items-center justify-center mb-3">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl border-2 mb-2"
                    style={{
                      backgroundColor: `${teamLeaderboard[0]?.color}20`,
                      borderColor: `${teamLeaderboard[0]?.color}50`,
                    }}
                  >
                    <TeamLogo logo={teamLeaderboard[0]?.logo} name={teamLeaderboard[0]?.name} size={32} />
                  </div>
                  <div className="text-lg font-bold text-white">{teamLeaderboard[0]?.name}</div>
                  <div className="text-sm text-yellow-400">{teamLeaderboard[0]?.territories} zones</div>
                </div>

                {/* 3ème place */}
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-600 rounded-t-2xl flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-2 mb-2"
                    style={{
                      backgroundColor: `${teamLeaderboard[2]?.color}20`,
                      borderColor: `${teamLeaderboard[2]?.color}50`,
                    }}
                  >
                    <TeamLogo logo={teamLeaderboard[2]?.logo} name={teamLeaderboard[2]?.name} size={24} />
                  </div>
                  <div className="text-sm font-bold text-white">{teamLeaderboard[2]?.name}</div>
                  <div className="text-xs text-gray-400">{teamLeaderboard[2]?.territories} zones</div>
                </div>
              </div>
            </div>

            {/* Classement complet */}
            <div className="space-y-3">
              {teamLeaderboard.map((team, index) => (
                <div
                  key={team.id}
                  className={`bg-gray-900 rounded-2xl border border-gray-800 p-4 ${
                    team.id === currentPlayer.team ? "ring-2 ring-purple-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                          index === 0
                            ? "bg-yellow-600 text-white"
                            : index === 1
                              ? "bg-gray-400 text-white"
                              : index === 2
                                ? "bg-orange-600 text-white"
                                : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border-2"
                        style={{ backgroundColor: `${team.color}20`, borderColor: `${team.color}50` }}
                      >
                        <TeamLogo logo={team.logo} name={team.name} size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg">{team.name}</div>
                        <div className="flex items-center space-x-3 text-sm text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{team.activePlayers}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Trophy className="h-3 w-3" />
                            <span>{team.wins} victoires</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{team.territories}</div>
                      <div className="text-sm text-gray-400">territoires</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            {/* Prix à gagner */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-3xl border border-purple-500/30 p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-6 text-center flex items-center justify-center">
                <Gift className="h-6 w-6 mr-2 text-yellow-400" />
                🏆 Prix du Tournoi Hebdomadaire
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {/* 1ère place */}
                <div className="text-center bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 rounded-2xl p-4 border border-yellow-500/30">
                  <div className="text-2xl mb-2">🥇</div>
                  <div className="text-lg font-bold text-yellow-400 mb-2">1ère Place</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-sm">
                      <Coins className="h-4 w-4 mr-1 text-yellow-400" />
                      <span className="text-white font-bold">5,000 CHZ</span>
                    </div>
                    <div className="text-xs text-gray-300">≈ $150 USD</div>
                    <div className="text-xs text-blue-300">+ Maillot Officiel</div>
                    <div className="text-xs text-purple-300">+ Badge Légendaire</div>
                  </div>
                </div>

                {/* 2ème place */}
                <div className="text-center bg-gradient-to-b from-gray-400/20 to-gray-500/10 rounded-2xl p-4 border border-gray-400/30">
                  <div className="text-2xl mb-2">🥈</div>
                  <div className="text-lg font-bold text-gray-300 mb-2">2ème Place</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-sm">
                      <Coins className="h-4 w-4 mr-1 text-gray-400" />
                      <span className="text-white font-bold">2,500 CHZ</span>
                    </div>
                    <div className="text-xs text-gray-300">≈ $75 USD</div>
                    <div className="text-xs text-blue-300">+ Maillot Rétro</div>
                    <div className="text-xs text-purple-300">+ Badge Épique</div>
                  </div>
                </div>

                {/* 3ème place */}
                <div className="text-center bg-gradient-to-b from-orange-600/20 to-orange-700/10 rounded-2xl p-4 border border-orange-600/30">
                  <div className="text-2xl mb-2">🥉</div>
                  <div className="text-lg font-bold text-orange-400 mb-2">3ème Place</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-sm">
                      <Coins className="h-4 w-4 mr-1 text-orange-400" />
                      <span className="text-white font-bold">1,000 CHZ</span>
                    </div>
                    <div className="text-xs text-gray-300">≈ $30 USD</div>
                    <div className="text-xs text-blue-300">+ Écharpe Équipe</div>
                    <div className="text-xs text-purple-300">+ Badge Rare</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <div className="text-xs text-gray-400">
                  🗓️ Tournoi se termine dans: <span className="text-white font-bold">2j 14h 32m</span>
                </div>
              </div>
            </div>

            {/* Top 3 joueurs */}
            <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-6 text-center">⭐ Top 3 Joueurs</h2>
              <div className="space-y-4">
                {playerLeaderboard.slice(0, 3).map((player, index) => {
                  const team = getTeamById(player.team)
                  const prizes = [
                    { chz: "5,000", usd: "$150", reward: "Maillot Officiel", badge: "Légendaire" },
                    { chz: "2,500", usd: "$75", reward: "Maillot Rétro", badge: "Épique" },
                    { chz: "1,000", usd: "$30", reward: "Écharpe Équipe", badge: "Rare" }
                  ]
                  const prize = prizes[index]
                  
                  return (
                    <div key={player.id} className={`flex items-center space-x-4 p-4 rounded-2xl border-2 ${
                      index === 0 ? "bg-yellow-500/5 border-yellow-500/30" :
                      index === 1 ? "bg-gray-400/5 border-gray-400/30" :
                      "bg-orange-600/5 border-orange-600/30"
                    }`}>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                          index === 0
                            ? "bg-yellow-600 text-white"
                            : index === 1
                              ? "bg-gray-400 text-white"
                              : "bg-orange-600 text-white"
                        }`}
                      >
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                      </div>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border-2"
                        style={{ backgroundColor: `${team?.color}20`, borderColor: `${team?.color}50` }}
                      >
                        <TeamLogo logo={team?.logo} name={team?.name} size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white text-lg flex items-center">
                          {player.name}
                          {index === 0 && <Crown className="h-4 w-4 ml-2 text-yellow-400" />}
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3" />
                            <span>Niveau {player.level}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Trophy className="h-3 w-3" />
                            <span>{player.wins} victoires</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs">
                          <span className={`font-bold ${
                            index === 0 ? "text-yellow-400" :
                            index === 1 ? "text-gray-300" :
                            "text-orange-400"
                          }`}>
                            🎁 {prize.chz} CHZ ({prize.usd}) + {prize.reward}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{player.territories}</div>
                        <div className="text-sm text-gray-400">zones</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Classement complet des joueurs */}
            <div className="space-y-3">
              {playerLeaderboard.slice(3).map((player, index) => {
                const team = getTeamById(player.team)
                return (
                  <div key={player.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-gray-700 text-gray-300">
                          {index + 4}
                        </div>
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg border-2"
                          style={{ backgroundColor: `${team?.color}20`, borderColor: `${team?.color}50` }}
                        >
                          <TeamLogo logo={team?.logo} name={team?.name} size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-white">{player.name}</div>
                          <div className="flex items-center space-x-3 text-sm text-gray-400">
                            <span>Niveau {player.level}</span>
                            <span>{player.wins} victoires</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">{player.territories}</div>
                        <div className="text-sm text-gray-400">zones</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Navigation />
      </div>
    </div>
  )
}
