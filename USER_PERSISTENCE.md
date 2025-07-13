# Système de Persistance des Utilisateurs

## Description
Le système de persistance permet de lier de manière permanente chaque adresse wallet à un compte utilisateur avec nom d'utilisateur et équipe sauvegardés.

## Fonctionnalités

### 1. Enregistrement d'utilisateur
- **Endpoint**: `POST /api/auth/register`
- **Données requises**: `walletAddress`, `username`, `teamId`
- **Comportement**: Crée un nouveau compte lié à l'adresse wallet
- **Sauvegarde**: Données automatiquement sauvegardées dans `src/data/users.json`

### 2. Connexion utilisateur
- **Endpoint**: `POST /api/auth/login`
- **Données requises**: `walletAddress`, `signature`, `message`
- **Comportement**: Récupère le compte existant lié à l'adresse wallet
- **Retour**: Données complètes du profil utilisateur

### 3. Mise à jour du profil
- **Endpoint**: `PUT /api/auth/profile`
- **Données**: `username`, `teamId`
- **Authentification**: Token requis
- **Sauvegarde**: Modifications automatiquement sauvegardées

### 4. Progression du jeu
- **Endpoint**: `POST /api/game/attack`
- **Mise à jour**: CHZ balance, XP, score, niveau
- **Sauvegarde**: Automatique après chaque attaque

## Structure des données utilisateur

```json
{
  "id": "unique_user_id",
  "username": "nom_utilisateur",
  "walletAddress": "0x...",
  "teamId": "barcelona",
  "team": "Barcelona",
  "chzBalance": 1000,
  "level": 1,
  "xp": 0,
  "score": 0,
  "subscriptionStatus": "basic",
  "isAdmin": false,
  "createdAt": 1752371860082
}
```

## Équipes disponibles
- `psg` → PSG
- `barcelona` → Barcelona
- `real` → Real Madrid
- `inter-miami` → Inter Miami
- `dortmund` → Dortmund
- `bayern` → Bayern Munich

## Sécurité
- Chaque adresse wallet ne peut avoir qu'un seul compte
- Sessions expirées automatiquement après 24 heures
- Nettoyage automatique des sessions toutes les heures

## Fichiers de persistance
- **Localisation**: `src/data/users.json`
- **Format**: JSON array avec tous les utilisateurs
- **Sauvegarde**: Automatique à chaque modification

## Avantages
1. **Persistance**: Les données survivent aux redémarrages du serveur
2. **Unicité**: Une adresse wallet = un compte unique
3. **Progression**: XP, niveau, et CHZ sauvegardés automatiquement
4. **Flexibilité**: Possibilité de changer nom et équipe
5. **Performance**: Chargement rapide en mémoire avec sauvegarde sur disque 