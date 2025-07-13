# Chain League Frontend

Frontend Next.js adapté pour l'API Chain League avec authentification Web3.

## 🚀 Installation et démarrage

### Prérequis
- Node.js 18+
- Backend Chain League en cours d'exécution sur `http://localhost:3000`

### Installation
```bash
cd frontend
npm install
```

### Variables d'environnement
Le fichier `.env.local` est déjà configuré avec :
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Démarrage
```bash
npm run dev
```

Le frontend sera accessible sur `http://localhost:3001`

## 🔐 Authentification

### Comptes de test disponibles

1. **Compte Admin**
   - Wallet: `0x1234567890123456789012345678901234567890`
   - Username: `admin`
   - CHZ Balance: 10000
   - Subscription: premium
   - Admin: oui

2. **Compte Test**
   - Wallet: `0x9876543210987654321098765432109876543210`
   - Username: `testuser`
   - CHZ Balance: 1000
   - Subscription: basic
   - Admin: non

### Méthodes de connexion

1. **MetaMask** (recommandé)
   - Cliquez sur "Connecter MetaMask"
   - Autorisez l'accès à votre wallet
   - Signez le message de connexion

2. **Connexion manuelle**
   - Entrez une adresse wallet valide
   - Cliquez sur "Connexion manuelle"

3. **Mode développement**
   - Cliquez sur "Connexion Admin (Test)" pour utiliser le compte admin

## 🎮 Fonctionnalités

### Page d'accueil
- Affichage des informations utilisateur
- Session de jeu en cours
- Classement des équipes
- Navigation rapide vers le jeu et les classements

### Authentification Web3
- Connexion avec MetaMask
- Gestion des tokens JWT
- Déconnexion automatique en cas d'erreur

### Intégration API
- Communication avec le backend sur `http://localhost:3000/api`
- Gestion des erreurs et rechargement automatique
- Intercepteurs pour les tokens d'authentification

## 🛠️ Structure du projet

```
frontend/
├── app/                    # Pages Next.js
│   ├── page.tsx           # Page d'accueil avec authentification
│   ├── game/              # Page de jeu
│   ├── leaderboard/       # Classements
│   └── profile/           # Profil utilisateur
├── components/            # Composants React
│   ├── ui/               # Composants UI (shadcn/ui)
│   ├── Header.tsx        # Header avec infos utilisateur
│   ├── Navigation.tsx    # Navigation mobile
│   └── WalletConnect.tsx # Composant de connexion wallet
├── hooks/                # Hooks personnalisés
│   └── useAuth.ts        # Hook d'authentification
├── lib/                  # Utilitaires
│   ├── api.ts            # Service API
│   ├── types.ts          # Types TypeScript
│   └── utils.ts          # Utilitaires
└── styles/               # Styles CSS
```

## 🔧 Configuration

### Backend
Assurez-vous que le backend Chain League est en cours d'exécution :
```bash
# Dans le dossier racine
npm start
```

### Frontend
Le frontend se connecte automatiquement au backend sur `http://localhost:3000/api`.

## 🎯 Utilisation

1. **Démarrez le backend** : `npm start` (dossier racine)
2. **Démarrez le frontend** : `npm run dev` (dossier frontend)
3. **Ouvrez** `http://localhost:3001`
4. **Connectez-vous** avec un des comptes de test
5. **Explorez** les fonctionnalités du jeu

## 🐛 Dépannage

### Erreur de connexion API
- Vérifiez que le backend est en cours d'exécution sur le port 3000
- Vérifiez les logs du backend pour les erreurs

### Erreur MetaMask
- Installez l'extension MetaMask
- Assurez-vous d'être connecté à MetaMask
- Autorisez l'accès au site

### Erreur de signature
- En mode développement, une signature simulée est utilisée
- En production, utilisez MetaMask pour signer les messages

## 📝 Notes de développement

- Le frontend utilise Next.js 15 avec App Router
- Tailwind CSS pour le styling
- shadcn/ui pour les composants
- Ethers.js pour l'intégration Web3
- Axios pour les appels API

## 🔄 Mise à jour

Pour mettre à jour le frontend avec de nouvelles fonctionnalités :

1. Modifiez les services dans `lib/api.ts`
2. Ajoutez les nouveaux types dans `lib/types.ts`
3. Créez les nouveaux composants dans `components/`
4. Mettez à jour les pages dans `app/` 