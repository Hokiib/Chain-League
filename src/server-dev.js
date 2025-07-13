require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const chilizService = require('./services/chilizService');

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'chain-league-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Fichier de persistance des utilisateurs
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const DATA_DIR = path.join(__dirname, 'data');

// Créer le dossier data s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fonction pour charger les utilisateurs depuis le fichier
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      const usersArray = JSON.parse(data);
      const usersMap = new Map();
      usersArray.forEach(user => {
        usersMap.set(user.id, user);
      });
      logger.info(`Loaded ${usersMap.size} users from database`);
      return usersMap;
    }
  } catch (error) {
    logger.error('Error loading users:', error);
  }
  return new Map();
}

// Fonction pour sauvegarder les utilisateurs dans le fichier
function saveUsers(usersMap) {
  try {
    const usersArray = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersArray, null, 2));
    logger.info(`Saved ${usersArray.length} users to database`);
  } catch (error) {
    logger.error('Error saving users:', error);
  }
}

const app = express();

const PORT = process.env.PORT || 3000;

// Stockage temporaire en mémoire pour les utilisateurs avec persistance
const users = loadUsers(); // Charger les utilisateurs depuis le fichier
const sessions = new Map();

// Fonction pour générer un ID unique
function generateUserId() {
  return Date.now() + Math.random().toString(36).substr(2, 9);
}

// Fonction pour générer un token de session
function generateSessionToken() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Fonction pour nettoyer les sessions expirées (24 heures)
function cleanExpiredSessions() {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > TWENTY_FOUR_HOURS) {
      sessions.delete(token);
    }
  }
}

// Nettoyer les sessions expirées toutes les heures
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Middleware pour vérifier l'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = users.get(session.userId);
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mode: 'development'
  });
});

// Endpoint pour vérifier le statut du service Chiliz
app.get('/api/chiliz/status', async (req, res) => {
  try {
    const networkStatus = await chilizService.checkNetwork();
    const walletInfo = await chilizService.getWalletInfo();
    
    res.json({
      success: true,
      network: networkStatus,
      wallet: walletInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Mock API endpoints for development
app.get('/api/players', (req, res) => {
  const playerList = Array.from(users.values()).map((user, index) => ({
    id: user.id,
    username: user.username,
    score: user.score || 0
  }));

  res.json({
    players: playerList.length > 0 ? playerList : [
      { id: 1, username: 'player1', score: 100 },
      { id: 2, username: 'player2', score: 85 },
      { id: 3, username: 'player3', score: 120 }
    ]
  });
});

app.get('/api/teams', (req, res) => {
  res.json({
    teams: [
      { id: 'barcelona', name: 'Barcelona', logo: '/teams/barcelona-final.png', color: '#004d98', subscribers: 18234 },
      { id: 'real', name: 'Real Madrid', logo: '/teams/real-madrid-final.png', color: '#ffffff', subscribers: 19891 },
      { id: 'psg', name: 'PSG', logo: '/teams/psg.png', color: '#004170', subscribers: 15847 },
      { id: 'bayern', name: 'Bayern Munich', logo: '/teams/bayern-new.png', color: '#dc052d', subscribers: 12891 },
      { id: 'dortmund', name: 'Borussia Dortmund', logo: '/teams/dortmund-new.png', color: '#fde100', subscribers: 7567 },
      { id: 'inter-miami', name: 'Inter Miami', logo: '/teams/inter-miami.png', color: '#f7b5cd', subscribers: 8432 }
    ]
  });
});

app.get('/api/game/status', (req, res) => {
  res.json({
    status: 'active',
    currentRound: 1,
    players: 3,
    timeRemaining: 300
  });
});

app.get('/api/game/current-session', (req, res) => {
  res.json({
    id: 1,
    status: 'active',
    start_time: new Date().toISOString(),
    total_players: 3,
    current_leader: 'TestUser'
  });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({
    leaderboard: [
      { rank: 1, username: 'player3', score: 120, team: 'Barcelona' },
      { rank: 2, username: 'player1', score: 100, team: 'Real Madrid' },
      { rank: 3, username: 'player2', score: 85, team: 'PSG' }
    ]
  });
});

// Authentication endpoints
app.get('/api/auth/nonce', (req, res) => {
  const { walletAddress } = req.query;
  
  res.json({
    nonce: Date.now().toString(),
    message: `Login to Chain League\n\nWallet: ${walletAddress}\nNonce: ${Date.now()}\n\nBy signing this message, you agree to authenticate with Chain League.`
  });
});

app.post('/api/auth/login', (req, res) => {
  const { walletAddress, username, signature, message } = req.body;
  
  console.log('Login request:', { walletAddress, username, hasSignature: !!signature, hasMessage: !!message });
  
  // Rechercher l'utilisateur existant par adresse wallet
  let user = Array.from(users.values()).find(u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase());
  
  if (!user) {
    // Utilisateur non trouvé, retourner une erreur pour déclencher l'inscription
    return res.status(404).json({
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found. Please register first.',
      needsRegistration: true
    });
  }
  
  // Créer une session
  const token = generateSessionToken();
  sessions.set(token, {
    userId: user.id,
    walletAddress: user.walletAddress,
    createdAt: Date.now()
  });
  
  // Équipes disponibles pour mapping
  const availableTeams = {
    'psg': 'PSG',
    'barcelona': 'Barcelona',
    'real': 'Real Madrid',
    'inter-miami': 'Inter Miami',
    'dortmund': 'Dortmund',
    'bayern': 'Bayern Munich'
  };
  
  res.json({
    success: true,
    player: {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      teamId: user.teamId,
      chzBalance: user.chzBalance,
      level: user.level,
      xp: user.xp,
      subscriptionStatus: user.subscriptionStatus,
      score: user.score,
      team: availableTeams[user.teamId] || 'PSG',
      isAdmin: user.isAdmin
    },
    token: token
  });
});

app.post('/api/auth/register', (req, res) => {
  const { walletAddress, username, teamId } = req.body;
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = Array.from(users.values()).find(u => u.walletAddress.toLowerCase() === walletAddress.toLowerCase());
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: 'USER_EXISTS',
      message: 'User already exists with this wallet address'
    });
  }
  
  // Équipes disponibles
  const availableTeams = {
    'psg': 'PSG',
    'barcelona': 'Barcelona',
    'real': 'Real Madrid',
    'inter-miami': 'Inter Miami',
    'dortmund': 'Dortmund',
    'bayern': 'Bayern Munich'
  };
  
  const selectedTeamId = teamId || 'psg';
  const selectedTeamName = availableTeams[selectedTeamId] || 'PSG';
  
  // Créer un nouvel utilisateur
  const userId = generateUserId();
  const newUser = {
    id: userId,
    username: username || 'NewUser',
    walletAddress: walletAddress,
    teamId: selectedTeamId,
    chzBalance: 1000,
    level: 1,
    xp: 0,
    subscriptionStatus: 'basic',
    score: 0,
    team: selectedTeamName,
    isAdmin: false,
    createdAt: Date.now()
  };
  
  // Stocker l'utilisateur
  users.set(userId, newUser);
  
  // Sauvegarder les utilisateurs dans le fichier
  saveUsers(users);
  
  // Créer une session
  const token = generateSessionToken();
  sessions.set(token, {
    userId: userId,
    walletAddress: walletAddress,
    createdAt: Date.now()
  });
  
  res.json({
    success: true,
    message: 'User registered successfully',
    player: {
      id: newUser.id,
      username: newUser.username,
      walletAddress: newUser.walletAddress,
      teamId: newUser.teamId,
      chzBalance: newUser.chzBalance,
      level: newUser.level,
      xp: newUser.xp,
      subscriptionStatus: newUser.subscriptionStatus,
      score: newUser.score,
      team: selectedTeamName,
      isAdmin: newUser.isAdmin
    },
    token: token
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    user: {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      score: user.score,
      team: user.team,
      isAdmin: user.isAdmin
    }
  });
});

app.get('/api/auth/profile', (req, res) => {
  // Pour compatibilité, on retourne les données sans authentification stricte
  // En production, cela devrait utiliser authenticateToken
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Équipes disponibles pour mapping
  const availableTeams = {
    'psg': 'PSG',
    'barcelona': 'Barcelona',
    'real': 'Real Madrid',
    'inter-miami': 'Inter Miami',
    'dortmund': 'Dortmund',
    'bayern': 'Bayern Munich'
  };
  
  res.json({
    player: {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      teamId: user.teamId,
      chzBalance: user.chzBalance,
      level: user.level,
      xp: user.xp,
      subscriptionStatus: user.subscriptionStatus,
      score: user.score,
      team: availableTeams[user.teamId] || 'PSG',
      isAdmin: user.isAdmin
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Endpoint pour mettre à jour le profil utilisateur
app.put('/api/auth/profile', (req, res) => {
  const { username, teamId } = req.body;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Équipes disponibles
  const availableTeams = {
    'psg': 'PSG',
    'barcelona': 'Barcelona',
    'real': 'Real Madrid',
    'inter-miami': 'Inter Miami',
    'dortmund': 'Dortmund',
    'bayern': 'Bayern Munich'
  };
  
  // Mettre à jour les informations
  if (username && username.trim()) {
    user.username = username.trim();
  }
  
  if (teamId && availableTeams[teamId]) {
    user.teamId = teamId;
    user.team = availableTeams[teamId];
  }
  
  // Sauvegarder les modifications
  saveUsers(users);
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    player: {
      id: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      teamId: user.teamId,
      chzBalance: user.chzBalance,
      level: user.level,
      xp: user.xp,
      subscriptionStatus: user.subscriptionStatus,
      score: user.score,
      team: user.team,
      isAdmin: user.isAdmin
    }
  });
});

// Game endpoints
app.get('/api/game/map', (req, res) => {
  res.json({
    map: {
      id: 1,
      name: 'Stadium Central',
      zones: [
        { id: 1, name: 'Zone A', team: 'Barcelona', players: 2 },
        { id: 2, name: 'Zone B', team: 'Real Madrid', players: 1 },
        { id: 3, name: 'Zone C', team: null, players: 0 }
      ]
    }
  });
});

app.post('/api/game/move', (req, res) => {
  const { zoneId } = req.body;
  res.json({
    success: true,
    message: `Moved to zone ${zoneId}`,
    newPosition: { x: 100, y: 200 }
  });
});

app.post('/api/game/attack', async (req, res) => {
  const { playerAddress, cellX, cellY, targetId, attackType } = req.body;
  
  try {
    // Trouver l'utilisateur par son adresse wallet
    const user = Array.from(users.values()).find(u => u.walletAddress.toLowerCase() === playerAddress.toLowerCase());
    
    // Générer les statistiques de jeu
    const xpGained = Math.floor(Math.random() * 20) + 5;
    const damage = Math.floor(Math.random() * 50) + 10;
    
    // Envoyer une vraie récompense CHZ via le service Chiliz
    const rewardResult = await chilizService.rewardPlayer(playerAddress, attackType || 'attack');
    
    // Mettre à jour les statistiques de l'utilisateur si trouvé
    if (user) {
      // Ajouter la récompense CHZ au solde local (pour l'affichage)
      user.chzBalance = (user.chzBalance || 1000) + rewardResult.amount;
      user.xp = (user.xp || 0) + xpGained;
      user.score = (user.score || 0) + damage;
      
      // Calculer le niveau basé sur l'XP
      user.level = Math.floor(user.xp / 100) + 1;
      
      // Sauvegarder les modifications
      saveUsers(users);
    }
    
    // Préparer la réponse avec les informations de transaction
    const response = {
      success: true,
      message: rewardResult.message,
      damage: damage,
      xpGained: xpGained,
      playerAddress,
      cellPosition: { x: cellX, y: cellY },
      blockchain: {
        isReal: !rewardResult.simulated,
        amount: rewardResult.amount,
        hash: rewardResult.hash || null,
        blockNumber: rewardResult.blockNumber || null,
        gasUsed: rewardResult.gasUsed || null,
        from: rewardResult.from || null,
        to: rewardResult.to || playerAddress
      }
    };

    // Ajouter des infos supplémentaires si c'est une vraie transaction
    if (!rewardResult.simulated && rewardResult.success) {
      response.message = `🎉 Attaque réussie ! Vraie récompense de ${rewardResult.amount} CHZ envoyée !`;
      logger.info(`🎮 Récompense réelle envoyée: ${rewardResult.amount} CHZ à ${playerAddress}`);
    } else if (rewardResult.simulated) {
      response.message = `⚡ Attaque réussie ! Récompense simulée: ${rewardResult.amount} CHZ`;
    }

    // Compatibilité avec l'ancien format (transaction)
    response.transaction = {
      hash: rewardResult.hash || `0x${Math.random().toString(16).substring(2, 18)}...`,
      blockNumber: rewardResult.blockNumber || Math.floor(Math.random() * 1000000) + 18000000,
      amount: rewardResult.amount,
      gasUsed: rewardResult.gasUsed || Math.floor(Math.random() * 50000) + 21000,
      gasPrice: '20000000000' // 20 gwei
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Erreur lors de l\'attaque:', error);
    
    // En cas d'erreur, retourner une réponse d'erreur mais fonctionnelle
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'attaque, récompense simulée',
      error: error.message,
      damage: Math.floor(Math.random() * 50) + 10,
      xpGained: Math.floor(Math.random() * 20) + 5,
      playerAddress,
      cellPosition: { x: cellX, y: cellY },
      blockchain: {
        isReal: false,
        amount: 0.005,
        hash: null,
        blockNumber: null
      },
      transaction: {
        hash: `0x${Math.random().toString(16).substring(2, 18)}...`,
        blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
        amount: 0.005,
        gasUsed: 21000,
        gasPrice: '20000000000'
      }
    });
  }
});

// Betting endpoints
app.get('/api/betting/matches', (req, res) => {
  res.json({
    matches: [
      { id: 1, team1: 'Barcelona', team2: 'Real Madrid', odds: 1.5, status: 'active' },
      { id: 2, team1: 'PSG', team2: 'Bayern', odds: 2.1, status: 'upcoming' }
    ]
  });
});

app.post('/api/betting/place', (req, res) => {
  const { matchId, amount, team } = req.body;
  res.json({
    success: true,
    message: 'Bet placed successfully',
    bet: {
      id: 1,
      matchId,
      amount,
      team,
      odds: 1.5,
      status: 'active'
    }
  });
});

// Shop endpoints
app.get('/api/shop/items', (req, res) => {
  res.json({
    boosts: [
      { 
        id: 1, 
        name: 'Power Boost', 
        price: 100, 
        description: 'Augmente vos dégâts de 50% pendant 1 heure',
        duration: 3600,
        icon: 'zap',
        color: 'yellow',
        effect: '+50% dégâts'
      },
      { 
        id: 2, 
        name: 'Cooldown Reduction', 
        price: 0.01, 
        description: 'Réduit le cooldown de vos attaques de 50% pendant 1 heure',
        duration: 3600,
        icon: 'clock',
        color: 'blue',
        effect: '-50% cooldown'
      },
      { 
        id: 3, 
        name: 'Shield', 
        price: 0.01, 
        description: 'Vous protège des attaques pendant 1 heure',
        duration: 3600,
        icon: 'shield',
        color: 'green',
        effect: 'Immunité aux dégâts'
      },
      { 
        id: 4, 
        name: 'Double XP', 
        price: 0.01, 
        description: 'Double votre gain d\'XP pendant 1 heure',
        duration: 3600,
        icon: 'star',
        color: 'purple',
        effect: '+100% XP'
      },
      { 
        id: 5, 
        name: 'Critical Hits', 
        price: 0.01, 
        description: 'Permet d\'infliger des dégâts critiques (2x dégâts) pendant 1 heure',
        duration: 3600,
        icon: 'target',
        color: 'red',
        effect: 'Dégâts critiques possibles'
      }
    ],
    cosmetics: [
      {
        id: 6,
        name: 'Avatar Doré',
        price: 500,
        description: 'Un avatar brillant qui impressionne vos adversaires',
        icon: 'crown',
        color: 'yellow',
        rarity: 'Légendaire',
        type: 'Avatar'
      },
      {
        id: 7,
        name: 'Effet de Particules',
        price: 300,
        description: 'Ajoutez des particules scintillantes à votre personnage',
        icon: 'star',
        color: 'purple',
        rarity: 'Épique',
        type: 'Effet'
      }
    ],
    subscriptions: [
      {
        id: 8,
        name: 'Premium VIP',
        price: 1000,
        description: 'Accès complet à tous les avantages premium',
        duration: 2592000, // 30 jours
        icon: 'crown',
        color: 'yellow',
        effect: {
          chzBonus: 1.5, // +50% CHZ
          allBoosts: true,
          priorityAccess: true,
          exclusiveCosmetics: true,
          vipBadge: true
        }
      }
    ]
  });
});

app.get('/api/shop/inventory', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Simuler un inventaire d'objets pour l'utilisateur
  res.json({
    boosts: [
      { 
        id: 1, 
        itemId: 1, 
        name: 'Power Boost', 
        quantity: 2, 
        description: 'Augmente vos dégâts de 50% pendant 1 heure',
        icon: 'zap',
        color: 'yellow',
        isActive: false,
        expiresAt: null
      },
      { 
        id: 2, 
        itemId: 2, 
        name: 'Cooldown Reduction', 
        quantity: 1, 
        description: 'Réduit le cooldown de vos attaques de 50% pendant 1 heure',
        icon: 'clock',
        color: 'blue',
        isActive: false,
        expiresAt: null
      },
      { 
        id: 3, 
        itemId: 3, 
        name: 'Shield', 
        quantity: 1, 
        description: 'Vous protège des attaques pendant 1 heure',
        icon: 'shield',
        color: 'green',
        isActive: false,
        expiresAt: null
      }
    ],
    cosmetics: [
      {
        id: 3,
        itemId: 6,
        name: 'Avatar Doré',
        quantity: 1,
        description: 'Un avatar brillant qui impressionne vos adversaires',
        icon: 'crown',
        color: 'yellow',
        isEquipped: false
      }
    ],
    subscriptions: [
      {
        id: 4,
        itemId: 8,
        name: 'Premium VIP',
        quantity: 1,
        description: 'Accès complet à tous les avantages premium',
        icon: 'crown',
        color: 'yellow',
        isExpired: false,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 jours
      }
    ]
  });
});

app.post('/api/shop/buy', async (req, res) => {
  const { itemId } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Simuler l'achat d'un objet
  const items = {
    1: { name: 'Power Boost', price: 100 },
    2: { name: 'Cooldown Reduction', price: 0.01 },
    3: { name: 'Shield', price: 0.01 },
    4: { name: 'Double XP', price: 0.01 },
    5: { name: 'Critical Hits', price: 0.01 }
  };
  
  const item = items[itemId];
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  if (user.chzBalance < item.price) {
    return res.status(400).json({ error: 'Insufficient CHZ balance' });
  }
  
  try {
    // Effectuer une vraie transaction CHZ
    const transactionResult = await chilizService.sendCHZ(
      user.walletAddress,
      item.price,
      `Achat: ${item.name}`
    );
    
    logger.info(`💰 Transaction CHZ réussie - Hash: ${transactionResult.hash}, Montant: ${item.price} CHZ`);
    
    // Déduire le prix du solde seulement si la transaction a réussi
    user.chzBalance -= item.price;
    
    // Sauvegarder les modifications
    saveUsers(users);
    
    res.json({
      success: true,
      message: 'Item purchased successfully with CHZ transaction',
      item: {
        id: itemId,
        name: item.name,
        price: item.price
      },
      newBalance: user.chzBalance,
      transaction: {
        hash: transactionResult.hash,
        amount: item.price,
        to: user.walletAddress
      }
    });
  } catch (error) {
    logger.error(`❌ Erreur lors de la transaction CHZ: ${error.message}`);
    res.status(500).json({ 
      error: 'Transaction failed', 
      message: error.message 
    });
  }
});

app.post('/api/shop/activate-boost', (req, res) => {
  const { itemId } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Simuler l'activation d'un boost
  const boostTypes = {
    1: { name: 'Power Boost', effect: '+50% dégâts', duration: 3600 },
    2: { name: 'Cooldown Reduction', effect: '-50% cooldown', duration: 3600 },
    3: { name: 'Shield', effect: 'Immunité aux dégâts', duration: 3600 },
    4: { name: 'Double XP', effect: '+100% XP', duration: 3600 },
    5: { name: 'Critical Hits', effect: 'Dégâts critiques possibles', duration: 3600 }
  };
  
  const boost = boostTypes[itemId] || boostTypes[1];
  
  res.json({
    success: true,
    message: 'Boost activated successfully',
    boost: {
      id: itemId,
      name: boost.name,
      duration: boost.duration, // 1 heure
      effect: boost.effect,
      expiresAt: Date.now() + (boost.duration * 1000)
    }
  });
});

// Swagger documentation
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chain League API (Development Mode)',
      version: '1.0.0',
      description: 'API pour le jeu Web3 multijoueur Chain League - Mode développement',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Development Server running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
  logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
  logger.info(`⚠️ Running in DEVELOPMENT mode without database`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 