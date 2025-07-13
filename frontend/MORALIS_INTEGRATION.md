# 🔥 Intégration Moralis Web3 - Chain League

## Vue d'ensemble

Cette intégration Moralis remplace le système d'authentification traditionnel par une solution Web3 complète, offrant :

- **Authentification Web3** avec signature de messages
- **Gestion des NFTs** et tokens
- **Base de données décentralisée** (en préparation)
- **APIs Web3** pour les transactions blockchain

## 🚀 Fonctionnalités Implémentées

### 1. Authentification Web3
- **Signature de messages** pour l'authentification sécurisée
- **Support multi-chaînes** (Chiliz, Ethereum, Polygon)
- **Gestion des profils utilisateur** avec Moralis
- **Persistance des sessions** via localStorage

### 2. Gestion des NFTs
- **Récupération des NFTs** de l'utilisateur
- **Métadonnées complètes** (nom, description, image, attributs)
- **Filtrage par collection** (Chain League spécifique)
- **Interface visuelle** avec galerie d'images

### 3. Gestion des Tokens
- **Balances de tokens** en temps réel
- **Prix USD** et variations 24h
- **Support CHZ** (Chiliz) et autres tokens de jeu
- **Interface de portefeuille** intégrée

## 📁 Structure des Fichiers

```
frontend/
├── lib/
│   ├── moralis.ts              # Configuration et service d'auth
│   └── moralis-nft.ts          # Service NFTs et tokens
├── components/
│   ├── MoralisUserInfo.tsx     # Affichage profil utilisateur
│   └── MoralisNFTGallery.tsx   # Galerie NFTs/tokens
├── hooks/
│   └── useAuth.ts              # Hook d'authentification Moralis
└── env.example                 # Variables d'environnement
```

## 🔧 Configuration

### 1. Variables d'Environnement

Créez un fichier `.env.local` avec :

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_MORALIS_API_KEY=your_moralis_api_key_here
```

### 2. Clé API Moralis

1. Créez un compte sur [Moralis](https://moralis.io)
2. Créez un nouveau projet
3. Copiez votre clé API
4. Ajoutez-la dans `.env.local`

## 🎮 Utilisation

### Authentification

```typescript
import { useAuth } from '@/hooks/useAuth';

const { login, logout, user, isAuthenticated } = useAuth();

// Connexion avec wallet
await login(walletAddress);

// Déconnexion
logout();
```

### NFTs et Tokens

```typescript
import { MoralisNFTService } from '@/lib/moralis-nft';

// Récupérer les NFTs
const nfts = await MoralisNFTService.getUserNFTs(walletAddress);

// Récupérer les tokens
const tokens = await MoralisNFTService.getTokenBalances(walletAddress);
```

## 🎨 Composants UI

### MoralisUserInfo
Affiche les informations de l'utilisateur connecté :
- Nom d'utilisateur
- Adresse wallet
- Balance CHZ
- Niveau et XP
- Statut d'abonnement

### MoralisNFTGallery
Galerie interactive pour les assets Web3 :
- Onglets NFTs/Tokens
- Images et métadonnées
- Prix et variations
- Attributs NFT

## 🔄 Prochaines Étapes

### Phase 2 : Base de Données Décentralisée
- [ ] Intégration Moralis Database
- [ ] Stockage des profils utilisateur
- [ ] Historique des parties
- [ ] Système de classement

### Phase 3 : Fonctionnalités Web3 Avancées
- [ ] Smart contracts pour les équipes
- [ ] NFTs de joueurs et stades
- [ ] Système de récompenses
- [ ] Marketplace NFT

### Phase 4 : Optimisations
- [ ] Cache des données
- [ ] Mise à jour en temps réel
- [ ] Notifications push
- [ ] Analytics Web3

## 🐛 Développement

### Mode Simulation
Pour le développement, les services utilisent des données simulées :

```typescript
// NFTs simulés
await MoralisNFTService.getMockChainLeagueNFTs(walletAddress);

// Tokens simulés
await MoralisNFTService.getMockGameTokens(walletAddress);
```

### Logs de Débogage
Activez les logs dans la console pour suivre :
- Tentatives de connexion
- Récupération des assets
- Erreurs d'authentification

## 🔒 Sécurité

- **Signatures vérifiées** par Moralis
- **Messages sécurisés** avec nonce
- **Validation des adresses** wallet
- **Gestion des erreurs** robuste

## 📊 Performance

- **Chargement asynchrone** des assets
- **Cache local** des données utilisateur
- **Optimisation des images** NFT
- **Lazy loading** des galeries

---

**🔥 Powered by Moralis Web3** 