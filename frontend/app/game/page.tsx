"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import { useAuth } from "@/hooks/useAuth"
import { TEAMS, type HexCell, type Player, type GameEvent } from "@/lib/types"
import { Sword, Shield, Clock, Zap, Target, Sparkles, Loader2 } from "lucide-react"
import TeamLogo from "@/components/team-logo"

const COOLDOWN_TIME = 3 * 1000 // 3 secondes
const SPECIAL_COOLDOWN = 60 * 60 * 1000

// Fonction pour contraindre une valeur entre un min et un max
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

// Fonction pour générer un nombre pseudo-aléatoire basé sur une chaîne
const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Fonction pour générer un score de base consistant
const getBaseScore = (cellId: string): number => {
  const hash = hashString(cellId)
  return (hash % 1500) + 500 // Entre 500 et 2000
}

function createHexGrid(radius: number): HexCell[] {
  const cells: HexCell[] = []

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)

    for (let r = r1; r <= r2; r++) {
      const s = -q - r
      const id = `${q},${r},${s}`

      const baseTeam = TEAMS.find((team) => team.basePosition.q === q && team.basePosition.r === r)

      let owner = "neutral"
      let hp = 1
      let maxHp = 3
      let isBase = false

      if (baseTeam) {
        owner = baseTeam.id
        hp = 8
        maxHp = 8
        isBase = true
      }

      cells.push({
        id,
        q,
        r,
        s,
        owner,
        hp,
        maxHp,
        isBase,
      })
    }
  }

  return cells
}

function getNeighbors(cell: HexCell, cells: HexCell[]): HexCell[] {
  const directions = [
    [1, 0, -1],
    [1, -1, 0],
    [0, -1, 1],
    [-1, 0, 1],
    [-1, 1, 0],
    [0, 1, -1],
  ]

  return directions
    .map(([dq, dr, ds]) => {
      const neighborId = `${cell.q + dq},${cell.r + dr},${cell.s + ds}`
      return cells.find((c) => c.id === neighborId)
    })
    .filter(Boolean) as HexCell[]
}

export default function GamePage() {
  const { isAuthenticated, loading, user } = useAuth();
  const [gameState, setGameState] = useState(() => ({
    cells: createHexGrid(4),
    currentPlayer: {
      id: "player1",
      name: "Joueur",
      team: "psg",
      lastAction: 0,
      specialCooldown: 0,
      chzBalance: 1247,
      level: 12,
      xp: 2340,
    } as Player,
    gameEvents: [] as GameEvent[],
    activeEvent: null as string | null,
  }))

  const [selectedCell, setSelectedCell] = useState<HexCell | null>(null)
  const [timeUntilAction, setTimeUntilAction] = useState(0)
  const [timeUntilSpecial, setTimeUntilSpecial] = useState(0)
  const [explosions, setExplosions] = useState<Array<{ id: string; x: number; y: number; timestamp: number }>>([])

  // États pour le pan seulement (zoom supprimé)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })

  const mapRef = useRef<HTMLDivElement>(null)

  // Fonction pour contraindre le pan (zoom supprimé)
  const setClampedPan = useCallback((newPan: { x: number; y: number }) => {
    const rect = mapRef.current?.getBoundingClientRect()
    if (!rect) return

    // Limites de pan réduites pour garder la carte visible
    const maxPanX = Math.max(0, (280 - rect.width) / 6)
    const maxPanY = Math.max(0, (280 - rect.height) / 6)

    setPan({
      x: clamp(newPan.x, -maxPanX, maxPanX),
      y: clamp(newPan.y, -maxPanY, maxPanY),
    })
  }, [])

  // Gestion simplifiée du début du toucher (pan seulement)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 1) {
      // Pan avec un doigt
      setIsPanning(true)
      setLastPanPoint({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      })
    }
  }, [])

  // Gestion simplifiée du mouvement tactile (pan seulement)
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1 && isPanning) {
        // Pan avec un doigt
        const deltaX = e.touches[0].clientX - lastPanPoint.x
        const deltaY = e.touches[0].clientY - lastPanPoint.y
        
        setClampedPan({ 
          x: pan.x + deltaX, 
          y: pan.y + deltaY 
        })

        setLastPanPoint({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        })
      }
    },
    [isPanning, lastPanPoint, pan, setClampedPan],
  )

  // Gestion simplifiée de la fin du toucher
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false)
    }
  }, [])

  // Fonction pour centrer la carte
  const centerMap = useCallback(() => {
    setPan({ x: 0, y: 0 })
  }, [])

  // Fonctions utilitaires pour les équipes
  const getTeamById = (id: string) => TEAMS.find((t) => t.id === id)
  const getCurrentTeam = () => getTeamById(gameState.currentPlayer.team)



  // Gestion du clic droit pour le pan (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { // Clic droit
      e.preventDefault()
      setIsPanning(true)
      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x
      const deltaY = e.clientY - lastPanPoint.y

      setClampedPan({ x: pan.x + deltaX, y: pan.y + deltaY })

      setLastPanPoint({
        x: e.clientX,
        y: e.clientY,
      })
    }
  }, [isPanning, lastPanPoint, pan, setClampedPan])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Empêcher le menu contextuel sur la carte
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // Timers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const actionCooldown = Math.max(0, gameState.currentPlayer.lastAction + COOLDOWN_TIME - now)
      const specialCooldown = Math.max(0, gameState.currentPlayer.specialCooldown + SPECIAL_COOLDOWN - now)

      setTimeUntilAction(actionCooldown)
      setTimeUntilSpecial(specialCooldown)
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState.currentPlayer.lastAction, gameState.currentPlayer.specialCooldown])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const canAttack = (cell: HexCell): boolean => {
    if (cell.owner === gameState.currentPlayer.team || gameState.currentPlayer.team === "neutral") return false
    const neighbors = getNeighbors(cell, gameState.cells)
    return neighbors.some((neighbor) => neighbor.owner === gameState.currentPlayer.team)
  }

  const canReinforce = (cell: HexCell): boolean => {
    return cell.owner === gameState.currentPlayer.team && cell.hp < cell.maxHp
  }

  const handleCellClick = (cell: HexCell) => {
    if (!isPanning) {
      setSelectedCell(cell)
    }
  }

  const handleAttack = useCallback(async () => {
    if (!selectedCell || timeUntilAction > 0 || !canAttack(selectedCell)) return

    // Ajouter l'animation d'explosion
    const rect = mapRef.current?.getBoundingClientRect()
    if (rect) {
      const size = 18
      const x = size * ((3 / 2) * selectedCell.q)
      const y = size * ((Math.sqrt(3) / 2) * selectedCell.q + Math.sqrt(3) * selectedCell.r)

      // Convertir les coordonnées SVG en coordonnées écran
      const screenX = (x + 160) * (rect.width / 320) + pan.x
      const screenY = (y + 160) * (rect.height / 320) + pan.y

      const explosionId = Date.now().toString()
      setExplosions((prev) => [
        ...prev,
        {
          id: explosionId,
          x: screenX,
          y: screenY,
          timestamp: Date.now(),
        },
      ])

      // Supprimer l'explosion après 1 seconde
      setTimeout(() => {
        setExplosions((prev) => prev.filter((exp) => exp.id !== explosionId))
      }, 1000)
    }

    setGameState((prev) => {
      const newCells = prev.cells.map((cell) => {
        if (cell.id === selectedCell.id) {
          const newHp = Math.max(0, cell.hp - (Math.random() > 0.7 ? 2 : 1))
          const newOwner = newHp === 0 ? prev.currentPlayer.team : cell.owner

          return {
            ...cell,
            hp: newHp === 0 ? 1 : newHp,
            owner: newOwner,
            lastAttacker: prev.currentPlayer.team,
          }
        }
        return cell
      })

      const event: GameEvent = {
        id: Date.now().toString(),
        type: selectedCell.hp === 1 ? "capture" : "attack",
        message:
          selectedCell.hp === 1
            ? `${getCurrentTeam()?.name} capture une zone !`
            : `${getCurrentTeam()?.name} attaque !`,
        timestamp: Date.now(),
        team: prev.currentPlayer.team,
      }

      return {
        ...prev,
        cells: newCells,
        currentPlayer: {
          ...prev.currentPlayer,
          lastAction: Date.now(),
          xp: prev.currentPlayer.xp + (selectedCell.hp === 1 ? 50 : 10),
          chzBalance: prev.currentPlayer.chzBalance + (selectedCell.hp === 1 ? 5 : 1),
        },
        gameEvents: [...prev.gameEvents.slice(-19), event],
      }
    })

    setSelectedCell(null)
  }, [selectedCell, timeUntilAction, gameState.currentPlayer.team, pan])

  const handleReinforce = useCallback(() => {
    if (!selectedCell || timeUntilAction > 0 || !canReinforce(selectedCell)) return

    setGameState((prev) => {
      const newCells = prev.cells.map((cell) => {
        if (cell.id === selectedCell.id) {
          return {
            ...cell,
            hp: Math.min(cell.maxHp, cell.hp + 1),
          }
        }
        return cell
      })

      return {
        ...prev,
        cells: newCells,
        currentPlayer: {
          ...prev.currentPlayer,
          lastAction: Date.now(),
          xp: prev.currentPlayer.xp + 5,
        },
      }
    })

    setSelectedCell(null)
  }, [selectedCell, timeUntilAction])

  const handleSpecialAction = useCallback(() => {
    if (timeUntilSpecial > 0) return

    const effects = ["💥 Attaque Critique!", "⚡ Boost de Vitesse!", "🛡️ Défense Renforcée!"]
    const effect = effects[Math.floor(Math.random() * effects.length)]

    setGameState((prev) => ({
      ...prev,
      currentPlayer: {
        ...prev.currentPlayer,
        specialCooldown: Date.now(),
        chzBalance: prev.currentPlayer.chzBalance + 10,
      },
      activeEvent: effect,
    }))

    setTimeout(() => {
      setGameState((prev) => ({ ...prev, activeEvent: null }))
    }, 3000)
  }, [timeUntilSpecial])

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
      <div className="min-h-screen bg-gray-950 text-white pb-24">
        <Header chzBalance={0} />
        <div className="px-4 py-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-white mb-2">Jeu</h1>
            <p className="text-gray-400">Connectez-vous pour jouer</p>
            <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-6 max-w-md mx-auto">
              <p className="text-gray-300 mb-4">Vous devez être connecté pour accéder au jeu.</p>
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

  // Calcul des scores
  const teamScores = TEAMS.map((team) => ({
    ...team,
    territories: gameState.cells.filter((cell) => cell.owner === team.id).length,
    totalHp: gameState.cells.filter((cell) => cell.owner === team.id).reduce((sum, cell) => sum + cell.hp, 0),
  })).sort((a, b) => b.territories - a.territories || b.totalHp - a.totalHp)

  // Rendu carte hexagonale
  const renderHexGrid = () => {
    const size = 18

    return (
      <div
        ref={mapRef}
        className="relative w-full max-w-md h-[400px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border-2 border-gray-700 touch-none overflow-hidden shadow-2xl flex items-center justify-center mx-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      >


        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "center center",
          }}
        >
          <svg viewBox="-140 -140 280 280" className="w-full h-full max-w-[380px] max-h-[380px]" preserveAspectRatio="xMidYMid meet">
            {gameState.cells.map((cell) => {
              const x = size * ((3 / 2) * cell.q)
              const y = size * ((Math.sqrt(3) / 2) * cell.q + Math.sqrt(3) * cell.r)

              const points = []
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i
                const px = x + size * Math.cos(angle)
                const py = y + size * Math.sin(angle)
                points.push(`${px},${py}`)
              }

              const team = getTeamById(cell.owner)
              const isSelected = selectedCell?.id === cell.id
              const canAct = canAttack(cell) || canReinforce(cell)

              // Couleur de bordure selon l'équipe
              let strokeColor = "#4a5568"
              let strokeWidth = 1

              if (team) {
                strokeColor = team.color
                strokeWidth = 2
              }

              if (isSelected) {
                strokeColor = "#a855f7"
                strokeWidth = 3
              }

              if (canAct && timeUntilAction === 0) {
                strokeColor = "#8b5cf6"
                strokeWidth = 3
              }

              return (
                <g key={cell.id}>
                  {/* Hexagone principal - couleur de l'équipe ou transparent pour neutre */}
                  <polygon
                    points={points.join(" ")}
                    fill={team ? `${team.color}40` : "#2d3748"}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    className="cursor-pointer transition-all duration-200 hover:stroke-purple-400 hover:fill-opacity-60"
                    onClick={() => handleCellClick(cell)}
                  />

                  {/* Animation de sélection */}
                  {canAct && timeUntilAction === 0 && (
                    <polygon
                      points={points.join(" ")}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                      opacity="0.6"
                      className="animate-pulse"
                    />
                  )}

                  {/* Base d'équipe avec avatar et score */}
                  {cell.isBase && team && (
                    <g>
                      {/* Avatar/Logo de l'équipe - directement intégré dans la zone */}
                      <foreignObject
                        x={x - 12}
                        y={y - 12}
                        width="24"
                        height="24"
                        className="pointer-events-none select-none"
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                            <TeamLogo logo={team.logo} name={team.name} size={16} />
                          </div>
                        </div>
                      </foreignObject>

                      {/* Score de la base - ajusté pour éviter le débordement */}
                      <text
                        x={x}
                        y={y + 14}
                        textAnchor="middle"
                        fontSize="8"
                        fill="white"
                        fontWeight="700"
                        className="pointer-events-none select-none"
                      >
                        {getBaseScore(cell.id)}
                      </text>
                    </g>
                  )}

                  {/* Zone normale avec icône d'équipe et HP */}
                  {!cell.isBase && (
                    <g>
                      {/* Logo de l'équipe au centre - remonté si équipe présente */}
                      {team && (
                        <foreignObject
                          x={x - 7}
                          y={y - 9}
                          width="14"
                          height="14"
                          className="pointer-events-none select-none"
                        >
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                              <TeamLogo logo={team.logo} name={team.name} size={10} />
                            </div>
                          </div>
                        </foreignObject>
                      )}

                      {/* HP en bas de la cellule */}
                      <text
                        x={x}
                        y={y + 12}
                        textAnchor="middle"
                        fontSize="9"
                        fill="white"
                        fontWeight="300"
                        className="pointer-events-none select-none"
                      >
                        {cell.hp}
                      </text>

                      {/* Nom de l'équipe seulement si pas neutre */}
                      {team && (
                        <text
                          x={x}
                          y={y + 18}
                          textAnchor="middle"
                          fontSize="6"
                          fill="white"
                          fontWeight="600"
                          className="pointer-events-none select-none"
                        >
                          {team.name.slice(0, 3).toUpperCase()}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Animations d'explosion */}
        {explosions.map((explosion) => (
          <div
            key={explosion.id}
            className="absolute pointer-events-none"
            style={{
              left: explosion.x,
              top: explosion.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative">
              {/* Explosion principale */}
              <div className="w-8 h-8 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div className="absolute inset-0 w-8 h-8 bg-yellow-400 rounded-full animate-pulse"></div>

              {/* Particules */}
              <div className="absolute -top-2 -left-2 w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
              <div className="absolute -top-2 -right-2 w-2 h-2 bg-red-400 rounded-full animate-bounce delay-75"></div>
              <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-150"></div>
              <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-200"></div>

              {/* Texte d'impact */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white font-bold text-xs animate-bounce">
                💥
              </div>
            </div>
          </div>
        ))}



        {gameState.activeEvent && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-3xl font-bold text-xl animate-bounce shadow-2xl">
              {gameState.activeEvent}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={gameState.currentPlayer.chzBalance} />

      <div className="px-4 py-6 space-y-4">
        {/* Classement en temps réel - Version compacte */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Live</h2>
            <Badge className="bg-green-600 text-white text-xs">
              <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></div>
              LIVE
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {teamScores.slice(0, 3).map((team, index) => (
              <div key={team.id} className="text-center">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-2 mx-auto ${
                    index === 0
                      ? "bg-yellow-600 text-white"
                      : index === 1
                        ? "bg-gray-400 text-white"
                        : "bg-orange-600 text-white"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="text-lg mb-1">
                  <TeamLogo logo={team.logo} name={team.name} size={24} />
                </div>
                <div className="text-xs font-medium text-white truncate">{team.name}</div>
                <div className="text-sm font-bold text-white">{team.territories}</div>
                <div className="text-xs text-gray-400">zones</div>
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="flex justify-center px-4">{renderHexGrid()}</div>

        {/* Selected Cell */}
        {selectedCell && (
          <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Target className="h-6 w-6 text-purple-400" />
                <span className="font-medium text-white text-lg">Zone sélectionnée</span>
              </div>
              <div className="flex items-center space-x-3">
                {getTeamById(selectedCell.owner) && (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <TeamLogo 
                      logo={getTeamById(selectedCell.owner)?.logo || ""} 
                      name={getTeamById(selectedCell.owner)?.name || ""} 
                      size={24} 
                    />
                  </div>
                )}
                <Badge className="bg-gray-800 text-gray-300 border-gray-700 text-sm px-3 py-1">
                  {selectedCell.owner === "neutral" ? "Neutre" : getTeamById(selectedCell.owner)?.name}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-400">Points de vie</span>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(selectedCell.hp / selectedCell.maxHp) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-white text-lg">
                  {selectedCell.hp}/{selectedCell.maxHp}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleAttack}
                disabled={!canAttack(selectedCell) || timeUntilAction > 0}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 h-16 rounded-2xl font-bold text-lg"
              >
                <Sword className="mr-3 h-5 w-5" />
                Attaquer
              </Button>

              <Button
                onClick={handleReinforce}
                disabled={!canReinforce(selectedCell) || timeUntilAction > 0}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 h-16 rounded-2xl font-bold text-lg"
              >
                <Shield className="mr-3 h-5 w-5" />
                Renforcer
              </Button>
            </div>
          </div>
        )}

        {/* Cooldowns */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-400" />
                <span className="font-medium text-white">Action</span>
              </div>
              <span className="text-sm font-mono text-gray-400">
                {timeUntilAction > 0 ? formatTime(timeUntilAction) : "Prêt"}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.max(0, 100 - (timeUntilAction / COOLDOWN_TIME) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-purple-400" />
                <span className="font-medium text-white">Spécial</span>
              </div>
              <span className="text-sm font-mono text-gray-400">
                {timeUntilSpecial > 0 ? formatTime(timeUntilSpecial) : "Prêt"}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.max(0, 100 - (timeUntilSpecial / SPECIAL_COOLDOWN) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Special Action */}
        <Button
          onClick={handleSpecialAction}
          disabled={timeUntilSpecial > 0}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 h-20 rounded-3xl text-2xl font-bold"
        >
          <Zap className="mr-3 h-6 w-6" />
          Action Spéciale
          {timeUntilSpecial === 0 && <Sparkles className="ml-3 h-6 w-6 animate-spin" />}
        </Button>
      </div>

      <Navigation />
    </div>
  )
}
