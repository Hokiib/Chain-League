# 🚀 Intégration Blockchain - Chain League

## 📋 Vue d'ensemble

Cette fonctionnalité permet aux joueurs de recevoir des récompenses en tokens CHZ (testnet) directement sur leur wallet à chaque attaque réussie dans le jeu.

## 🔧 Configuration

### 1. Variables d'environnement

Dans le fichier `.env` du backend, ajoutez :

```env
# Blockchain Configuration
CHILIZ_RPC_URL=https://rpc-1.scoville.chiliz.com
PRIVATE_KEY=your_testnet_private_key_here
```

### 2. Obtenir une clé privée testnet

1. Créez un wallet sur MetaMask
2. Ajoutez le réseau Chiliz Scoville Testnet :
   - RPC URL: `https://rpc-1.scoville.chiliz.com`
   - Chain ID: `88882`
   - Currency: `CHZ`
3. Obtenez des tokens CHZ testnet depuis un faucet
4. Exportez la clé privée du wallet

## 🎮 Utilisation

### Frontend

1. **Accédez au jeu** : http://localhost:3001/game
2. **Configurez votre wallet** : Entrez votre adresse wallet dans le champ "Adresse Wallet"
3. **Attaquez une cellule** : Cliquez sur une cellule ennemie et appuyez sur "Attaquer"
4. **Recevez votre récompense** : 0.001 CHZ sera envoyé à votre adresse

### Backend

La route `/api/game/attack` accepte :

```json
{
  "playerAddress": "0x...",
  "cellX": 5,
  "cellY": 3
}
```

Et retourne :

```json
{
  "success": true,
  "message": "Attack successful! You received 0.001 CHZ as reward.",
  "transaction": {
    "hash": "0x...",
    "amount": "0.001",
    "blockNumber": 12345
  },
  "cell": {
    "x": 5,
    "y": 3
  }
}
```

## 🔍 Fonctionnalités

### ✅ Implémenté

- [x] Route `/api/game/attack` dans le backend
- [x] Service `sendTransactionToPlayer` avec Ethers.js
- [x] Interface utilisateur pour configurer l'adresse wallet
- [x] Appel API depuis le frontend lors d'une attaque
- [x] Affichage du hash de transaction dans une alert
- [x] Validation des adresses Ethereum
- [x] Gestion des erreurs

### 🔄 Améliorations possibles

- [ ] Intégration MetaMask pour la connexion automatique
- [ ] Historique des transactions
- [ ] Notifications push pour les récompenses
- [ ] Système de paris avec tokens CHZ
- [ ] NFT pour les équipes gagnantes

## 🛠️ Développement

### Structure des fichiers

```
Chain-League/
├── src/
│   ├── services/
│   │   └── web3Service.js          # Service blockchain
│   └── routes/
│       └── game.js                 # Route /attack
└── frontnew/
    └── app/
        └── game/
            └── page.tsx            # Interface de jeu
```

### Dépendances

- **Backend** : `ethers` (pour les transactions blockchain)
- **Frontend** : Aucune dépendance supplémentaire

## 🚨 Sécurité

⚠️ **Important** : 
- Utilisez uniquement des clés privées de testnet
- Ne partagez jamais votre clé privée
- Testez d'abord avec de petites sommes
- Surveillez les logs pour détecter les erreurs

## 🐛 Dépannage

### Erreurs courantes

1. **"PRIVATE_KEY not found"**
   - Vérifiez que la variable d'environnement est définie

2. **"Insufficient funds"**
   - Assurez-vous que le wallet a suffisamment de CHZ pour les frais de gas

3. **"Invalid address"**
   - Vérifiez que l'adresse wallet est valide (format 0x...)

4. **"Network error"**
   - Vérifiez la connexion au RPC Chiliz
   - Assurez-vous que le réseau est accessible

### Logs utiles

Les logs du backend affichent :
- 🚀 Transaction envoyée
- ✅ Transaction confirmée
- ❌ Erreurs de transaction

## 📊 Statistiques

- **Montant par attaque** : 0.001 CHZ
- **Frais de gas** : Variables selon le réseau
- **Temps de confirmation** : ~5-15 secondes
- **Réseau** : Chiliz Scoville Testnet

---

**Chain League** - Le futur du gaming Web3 ! 🎮⚡ 