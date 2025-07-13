export interface Team {
  id: string
  name: string
  color: string
  logo: string
  subscribers: number
  basePosition: { q: number; r: number }
}

export interface HexCell {
  id: string
  q: number
  r: number
  s: number
  owner: string
  hp: number
  maxHp: number
  isBase: boolean
  lastAttacker?: string
}

export interface Player {
  id: string
  name: string
  team: string
  lastAction: number
  specialCooldown: number
  chzBalance: number
  subscription?: string
  level: number
  xp: number
}

export interface GameMatch {
  id: string
  name: string
  status: "live" | "upcoming" | "finished"
  startTime: Date
  endTime?: Date
  teams: Team[]
  currentLeader?: string
  totalPlayers: number
}

export interface ChatMessage {
  id: string
  player: string
  message: string
  timestamp: number
  team: string
}

export interface GameEvent {
  id: string
  type: "attack" | "capture" | "special" | "event"
  message: string
  timestamp: number
  team?: string
}

export const TEAMS: Team[] = [
  {
    id: "psg",
    name: "PSG",
    color: "#004170",
    logo: "/teams/psg.png",
    subscribers: 15847,
    basePosition: { q: -4, r: 4 },
  },
  {
    id: "barcelona",
    name: "BARCA",
    color: "#A50044",
    logo: "/teams/barcelona-final.png",
    subscribers: 18234,
    basePosition: { q: 4, r: -4 },
  },
  {
    id: "real",
    name: "REAL",
    color: "#FEBE10",
    logo: "/teams/real-madrid-final.png",
    subscribers: 19891,
    basePosition: { q: -4, r: 0 },
  },
  {
    id: "inter-miami",
    name: "INTER MIAMI",
    color: "#F7B5CD",
    logo: "/teams/inter-miami.png",
    subscribers: 8432,
    basePosition: { q: 4, r: 0 },
  },
  {
    id: "dortmund",
    name: "DORTMUND",
    color: "#FDE100",
    logo: "/teams/dortmund-new.png",
    subscribers: 7567,
    basePosition: { q: 0, r: 4 },
  },
  {
    id: "bayern",
    name: "BAYERN",
    color: "#DC052D",
    logo: "/teams/bayern-new.png",
    subscribers: 12891,
    basePosition: { q: 0, r: -4 },
  },
]

// Types pour MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
