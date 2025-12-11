# API Email Temporaire

## Overview
API Node.js pour générer des emails temporaires et récupérer la boîte de réception. Utilise l'API mail.tm comme backend.

## Routes Disponibles

### GET /
Affiche les informations de l'API et les routes disponibles.

### GET /temp?mail=create
Génère un nouvel email temporaire.

**Réponse:**
```json
{
  "success": true,
  "email": "example@domain.com",
  "token": "jwt_token_here",
  "info": "Email temporaire créé avec succès..."
}
```

### GET /boite?message=EMAIL
Récupère la boîte de réception pour l'email spécifié.

**Exemple:** `/boite?message=example@domain.com`

**Réponse:**
```json
{
  "success": true,
  "email": "example@domain.com",
  "inbox": [...],
  "count": 0
}
```

### GET /message/:id?email=EMAIL
Lit le contenu complet d'un message spécifique.

## Structure du Projet
- `index.js` - Serveur Express avec les routes API
- `package.json` - Dépendances Node.js

## Dépendances
- express - Serveur web
- axios - Client HTTP
- cheerio - Parser HTML (pour le scraping)

## Port
Le serveur écoute sur le port 5000.

## Notes Importantes
- Les emails sont stockés en mémoire et seront perdus au redémarrage du serveur
- L'API utilise mail.tm comme service backend (tmailor.com bloque les requêtes de scraping)
