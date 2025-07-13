# 🔑 Configuration Moralis API

## Étape 1 : Obtenir une Clé API Moralis

1. **Allez sur [Moralis.io](https://moralis.io)**
2. **Créez un compte** ou connectez-vous
3. **Créez un nouveau projet** :
   - Cliquez sur "Create New Project"
   - Donnez un nom à votre projet (ex: "Chain League")
   - Sélectionnez "Web3 API" comme type
4. **Copiez votre clé API** depuis le dashboard

## Étape 2 : Configurer la Clé API

### Créez le fichier `.env.local` dans le dossier `frontend` :

```bash
# Configuration API
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Configuration Moralis Web3
NEXT_PUBLIC_MORALIS_API_KEY=votre_cle_api_moralis_ici
```

### Exemple de configuration :

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjEyMzQ1Njc4OTAiLCJhZGRyZXNzIjoiMHgxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwIiwidGltZXN0YW1wIjoxNjM0NTY3ODkwfQ.example_signature
```

## Étape 3 : Vérifier la Configuration

1. **Redémarrez le serveur de développement** :
   ```bash
   npm run dev
   ```

2. **Vérifiez dans la console** qu'il n'y a plus d'erreur "apiKey is not set"

3. **Testez la connexion** avec un wallet

## 🔧 Configuration Alternative pour le Développement

Si vous n'avez pas encore de clé API Moralis, vous pouvez utiliser le mode développement :

### Modifiez `lib/moralis.ts` :

```typescript
// Configuration Moralis
export const MORALIS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_MORALIS_API_KEY || 'development_key',
  // ... reste de la config
};
```

### Modifiez `lib/moralis-nft.ts` pour utiliser les données simulées :

```typescript
// Dans les fonctions, utilisez les données simulées si pas de clé API
if (!process.env.NEXT_PUBLIC_MORALIS_API_KEY) {
  return this.getMockChainLeagueNFTs(walletAddress);
}
```

## 🚨 Résolution des Erreurs

### Erreur "apiKey is not set"
- Vérifiez que le fichier `.env.local` existe
- Vérifiez que la variable `NEXT_PUBLIC_MORALIS_API_KEY` est définie
- Redémarrez le serveur de développement

### Erreur "Incorrect network provided"
- ✅ **Corrigé** : Utilise maintenant 'evm' pour l'authentification

### Erreur de connexion wallet
- Vérifiez que MetaMask est installé
- Vérifiez que vous êtes connecté au bon réseau (Chiliz)

## 📝 Notes Importantes

- **La clé API Moralis est gratuite** pour les projets de développement
- **Limite de 25,000 requêtes/mois** en version gratuite
- **Redémarrez toujours le serveur** après modification des variables d'environnement
- **Vérifiez la console** pour les erreurs de configuration

---

**🔥 Une fois configuré, vous pourrez utiliser toutes les fonctionnalités Web3 de Moralis !** 