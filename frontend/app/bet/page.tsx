"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import { TEAMS } from "@/lib/types"
import { DollarSign, TrendingUp, Clock, Target, History } from "lucide-react"
import { getGlobalGameState } from "@/lib/game-state"
import TeamLogo from "@/components/team-logo"

interface Bet {
  id: string
  teamId: string
  amount: number
  odds: number
  potentialWin: number
  timestamp: number
  status: "pending" | "won" | "lost"
}

export default function BetPage() {
  const [currentPlayer] = useState({
    chzBalance: 1247,
    team: "psg",
  })

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState("")
  const [gameStats, setGameStats] = useState<any>(null)
  const [userBets, setUserBets] = useState<Bet[]>([
    {
      id: "bet1",
      teamId: "psg",
      amount: 100,
      odds: 2.5,
      potentialWin: 250,
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
      status: "pending",
    },
    {
      id: "bet2",
      teamId: "barcelona",
      amount: 50,
      odds: 3.2,
      potentialWin: 160,
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
      status: "won",
    },
  ])

  // Update stats from game
  useEffect(() => {
    const updateStats = () => {
      const globalState = getGlobalGameState()
      if (globalState.cells.length > 0) {
        setGameStats(globalState)
      }
    }

    updateStats()
    const interval = setInterval(updateStats, 1000)

    return () => clearInterval(interval)
  }, [])

  // Calculate odds based on team performance
  const getTeamOdds = (teamId: string) => {
    if (!gameStats || !gameStats.teamStats) {
      // Default odds if no game data
      const baseOdds: { [key: string]: number } = {
        psg: 2.1,
        barcelona: 2.8,
        real: 2.5,
        "inter-miami": 4.2,
        dortmund: 3.5,
        bayern: 3.0,
      }
      return baseOdds[teamId] || 3.0
    }

    const teamStat = gameStats.teamStats[teamId]
    if (!teamStat) return 3.0

    // Calculate odds based on territories and performance
    const territories = teamStat.territories || 0
    const totalTerritories = Object.values(gameStats.teamStats).reduce(
      (sum: number, stat: any) => sum + (stat.territories || 0),
      0,
    )

    const winRate = totalTerritories > 0 ? territories / totalTerritories : 0

    // Higher win rate = lower odds (better team)
    if (winRate > 0.3) return 1.8 + Math.random() * 0.4 // 1.8-2.2
    if (winRate > 0.2) return 2.2 + Math.random() * 0.6 // 2.2-2.8
    if (winRate > 0.1) return 2.8 + Math.random() * 0.8 // 2.8-3.6
    return 3.6 + Math.random() * 1.4 // 3.6-5.0
  }

  const getTeamById = (id: string) => TEAMS.find((t) => t.id === id)

  const handlePlaceBet = () => {
    if (!selectedTeam || !betAmount || Number.parseFloat(betAmount) <= 0) return

    const amount = Number.parseFloat(betAmount)
    if (amount > currentPlayer.chzBalance) {
      alert("Insufficient CHZ balance!")
      return
    }

    const odds = getTeamOdds(selectedTeam)
    const potentialWin = amount * odds

    const newBet: Bet = {
      id: Date.now().toString(),
      teamId: selectedTeam,
      amount,
      odds,
      potentialWin,
      timestamp: Date.now(),
      status: "pending",
    }

    setUserBets((prev) => [newBet, ...prev])
    setBetAmount("")
    setSelectedTeam(null)
    alert(`Bet placed! ${amount} CHZ on ${getTeamById(selectedTeam)?.name} with ${odds.toFixed(2)}x odds`)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-green-600"
      case "lost":
        return "bg-red-600"
      default:
        return "bg-yellow-600"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "won":
        return "Won"
      case "lost":
        return "Lost"
      default:
        return "Pending"
    }
  }

  // Calculate next match countdown (simulated)
  const nextMatchTime = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
  const [timeUntilMatch, setTimeUntilMatch] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const diff = nextMatchTime.getTime() - now.getTime()

      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeUntilMatch(`${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)
      } else {
        setTimeUntilMatch("Match Started!")
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={currentPlayer.chzBalance} />

      <div className="px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Betting Arena</h1>
          <p className="text-gray-400">Bet on your favorite team to win the next match</p>
          {gameStats && (
            <Badge className="bg-green-600 text-white mt-2">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
              Live odds based on current performance
            </Badge>
          )}
        </div>

        {/* Next Match Countdown */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-3xl border border-purple-500/50 p-6 mb-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Next Match Starts In</h2>
            <div className="text-4xl font-bold text-yellow-400 mb-2">{timeUntilMatch}</div>
            <p className="text-gray-300">European Battle Championship</p>
            <Badge className="bg-red-600 text-white mt-2 animate-pulse">
              <Clock className="h-3 w-3 mr-1" />
              Betting closes when match starts
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="bet" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900 rounded-2xl h-14 mb-6">
            <TabsTrigger
              value="bet"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Place Bet
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold"
            >
              <History className="h-5 w-5 mr-2" />
              My Bets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bet" className="space-y-6">
            {/* Team Selection */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Choose Your Team</h3>
              <div className="grid gap-4">
                {TEAMS.map((team) => {
                  const odds = getTeamOdds(team.id)
                  const isSelected = selectedTeam === team.id
                  const territories = gameStats?.teamStats[team.id]?.territories || 0

                  return (
                    <div
                      key={team.id}
                      onClick={() => setSelectedTeam(team.id)}
                      className={`bg-gray-900 rounded-2xl border-2 p-4 cursor-pointer transition-all ${
                        isSelected ? "border-purple-500 bg-purple-600/20" : "border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                            style={{
                              backgroundColor: `${team.color}20`,
                              borderColor: `${team.color}50`,
                            }}
                          >
                            <TeamLogo logo={team.logo} name={team.name} size={32} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-lg">{team.name}</h4>
                            <div className="flex items-center space-x-3 text-sm text-gray-400">
                              <div className="flex items-center space-x-1">
                                <Target className="h-3 w-3" />
                                <span>{territories} territories</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <TrendingUp className="h-3 w-3" />
                                <span>{team.subscribers.toLocaleString()} fans</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-yellow-400">{odds.toFixed(2)}x</div>
                          <div className="text-sm text-gray-400">odds</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bet Amount */}
            {selectedTeam && (
              <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Place Your Bet</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Bet Amount (CHZ)</label>
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Enter amount..."
                      className="bg-gray-800 border-gray-700 text-white rounded-xl h-12"
                      max={currentPlayer.chzBalance}
                    />
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>Available: {currentPlayer.chzBalance} CHZ</span>
                      <span>Min bet: 10 CHZ</span>
                    </div>
                  </div>

                  {betAmount && Number.parseFloat(betAmount) > 0 && (
                    <div className="bg-gray-800 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Team:</span>
                        <span className="text-white font-bold">{getTeamById(selectedTeam)?.name}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Bet Amount:</span>
                        <div className="flex items-center space-x-2">
                          <img src="/chz-logo.webp" alt="CHZ" className="h-5 w-5" />
                          <span className="text-2xl font-bold text-yellow-400">
                            {Number.parseFloat(betAmount) % 1 === 0
                              ? `${Number.parseFloat(betAmount)}.0`
                              : Number.parseFloat(betAmount)}
                          </span>
                          <span className="text-gray-400">CHZ</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Odds:</span>
                        <span className="text-yellow-400 font-bold">{getTeamOdds(selectedTeam).toFixed(2)}x</span>
                      </div>
                      <div className="border-t border-gray-700 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Potential Win:</span>
                          <span className="text-green-400 font-bold text-xl">
                            {(Number.parseFloat(betAmount) * getTeamOdds(selectedTeam)) % 1 === 0
                              ? `${(Number.parseFloat(betAmount) * getTeamOdds(selectedTeam)).toFixed(0)}.0`
                              : (Number.parseFloat(betAmount) * getTeamOdds(selectedTeam)).toFixed(1)}{" "}
                            CHZ
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handlePlaceBet}
                    disabled={
                      !betAmount ||
                      Number.parseFloat(betAmount) <= 0 ||
                      Number.parseFloat(betAmount) > currentPlayer.chzBalance
                    }
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 h-14 rounded-2xl font-bold text-lg"
                  >
                    <DollarSign className="mr-2 h-5 w-5" />
                    Place Bet
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Betting History</h3>
              <Badge className="bg-gray-700 text-gray-300">{userBets.length} bets</Badge>
            </div>

            {userBets.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No bets placed yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userBets.map((bet) => {
                  const team = getTeamById(bet.teamId)
                  return (
                    <div key={bet.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 flex items-center justify-center">
                            <TeamLogo logo={team?.logo} name={team?.name} size={32} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white">{team?.name}</h4>
                            <p className="text-sm text-gray-400">{formatTime(bet.timestamp)}</p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(bet.status)} text-white`}>
                          {getStatusText(bet.status)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-white">
                            {bet.amount % 1 === 0 ? `${bet.amount}.0` : bet.amount}
                          </div>
                          <div className="text-xs text-gray-400">Bet Amount</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-yellow-400">{bet.odds.toFixed(2)}x</div>
                          <div className="text-xs text-gray-400">Odds</div>
                        </div>
                        <div>
                          <div
                            className={`text-lg font-bold ${bet.status === "won" ? "text-green-400" : bet.status === "lost" ? "text-red-400" : "text-gray-300"}`}
                          >
                            {bet.potentialWin % 1 === 0
                              ? `${bet.potentialWin.toFixed(0)}.0`
                              : bet.potentialWin.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {bet.status === "pending" ? "Potential Win" : bet.status === "won" ? "Won" : "Lost"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Navigation />
    </div>
  )
} 