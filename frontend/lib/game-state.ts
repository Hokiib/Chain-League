// Améliorer le système de persistance avec localStorage
export interface GlobalGameState {
  cells: any[]
  currentPlayer: any
  teamStats: {
    [teamId: string]: {
      territories: number
      totalHp: number
      activePlayers: number
    }
  }
  playerStats: {
    [playerId: string]: {
      damageDealt: number
      level: number
      xp: number
    }
  }
  gameEvents: any[]
  lastUpdate: number
}

// Clé pour localStorage
const GAME_STATE_KEY = "chain-league-game-state"

// État global avec persistance
let globalGameState: GlobalGameState = {
  cells: [],
  currentPlayer: null,
  teamStats: {},
  playerStats: {},
  gameEvents: [],
  lastUpdate: 0,
}

// Charger l'état depuis localStorage au démarrage
const loadGameState = (): GlobalGameState => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(GAME_STATE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Vérifier que l'état n'est pas trop ancien (plus de 24h)
        if (Date.now() - parsed.lastUpdate < 24 * 60 * 60 * 1000) {
          return parsed
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'état du jeu:", error)
    }
  }
  return globalGameState
}

// Sauvegarder l'état dans localStorage
const saveGameState = (state: GlobalGameState) => {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state))
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'état du jeu:", error)
    }
  }
}

// Initialiser avec l'état sauvegardé
globalGameState = loadGameState()

export const getGlobalGameState = () => globalGameState

export const setGlobalGameState = (state: GlobalGameState) => {
  globalGameState = { ...state, lastUpdate: Date.now() }
  saveGameState(globalGameState)
}

// Fonction pour réinitialiser le jeu
export const resetGameState = () => {
  globalGameState = {
    cells: [],
    currentPlayer: null,
    teamStats: {},
    playerStats: {},
    gameEvents: [],
    lastUpdate: 0,
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem(GAME_STATE_KEY)
  }
} 