# Chain League - Jeu Web3 Multijoueur

Un jeu de stratégie Web3 où vous dominez la carte avec votre équipe.

## 🚀 Déploiement

### Frontend
- Framework : Next.js 15
- Styling : Tailwind CSS
- UI : Radix UI + shadcn/ui

### Backend
- Framework : Node.js + Express
- Base de données : PostgreSQL + Redis
- Blockchain : Chiliz Scoville Testnet

## 🛠️ Installation

### Backend
```bash
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### Variables d'environnement Backend
```env
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chain_league
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_jwt_secret

# Blockchain
CHILIZ_RPC_URL=https://rpc-1.scoville.chiliz.com
PRIVATE_KEY=your_private_key

# Frontend
FRONTEND_URL=http://localhost:3001
```

### Variables d'environnement Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_MORALIS_API_KEY=your_moralis_api_key
```

## 🎮 Fonctionnalités

- Authentification Web3 avec MetaMask
- Jeu multijoueur en temps réel
- Système de récompenses blockchain
- Classements et équipes
- Boutique in-game
- NFTs et tokens

## 📚 Documentation

- [Intégration Blockchain](BLOCKCHAIN_INTEGRATION.md)
- [Intégration Moralis](frontend/MORALIS_INTEGRATION.md)
- [Configuration Moralis](frontend/SETUP_MORALIS.md) 
