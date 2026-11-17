# La Pyramide 🃏

Jeu à boire multijoueur en temps réel. Chaque joueur sur son propre téléphone.  
Anti-triche : le serveur ne transmet jamais les cartes d'un joueur aux autres.

---

## Lancement en local (développement)

### Prérequis
- Node.js ≥ 18 (`node -v` pour vérifier)

### Installation

```bash
cd pyramid-game
npm install
```

### Démarrer les deux serveurs

Dans deux terminaux séparés :

**Terminal 1 – serveur Node.js (port 3001)**
```bash
npm run dev:server
```

**Terminal 2 – client Vite (port 5173)**
```bash
npm run dev:client
```

Ouvre **http://localhost:5173** dans ton navigateur (ou sur ton téléphone via l'IP locale de ton ordi, ex. `http://192.168.1.42:5173`).

### Tests unitaires

```bash
npm test
```

---

## Déploiement gratuit sur Railway

Railway détecte automatiquement Node.js et suit les instructions de `nixpacks.toml`.

### Étapes pas à pas

1. **Crée un compte gratuit** sur [railway.app](https://railway.app)

2. **Pousse le projet sur GitHub** (ou GitLab) :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Crée un repo sur github.com puis :
   git remote add origin https://github.com/<toi>/<ton-repo>.git
   git push -u origin main
   ```

3. **Crée un projet Railway** :
   - Clique sur **New Project** → **Deploy from GitHub repo**
   - Sélectionne ton repo
   - Railway détecte Node.js et lit `nixpacks.toml` : il installe les dépendances, build le client React, puis lance le serveur

4. **Variable d'environnement** (optionnel mais recommandé) :
   - Dans le dashboard Railway → ton service → **Variables**
   - `NODE_ENV` = `production` (normalement déjà injecté par Railway)

5. **Accède à l'URL** :
   - Railway génère une URL publique style `https://pyramide-xxx.up.railway.app`
   - Envoie ce lien à tes amis → ils ouvrent sur leur téléphone et rejoignent

6. **Domaine personnalisé** (optionnel, gratuit sur Railway) :
   - Settings → Domains → Add custom domain

> **Limitations Railway gratuit** : 500 heures/mois d'exécution (amplement suffisant pour des soirées).  
> L'instance se met en veille après inactivité (~5 min) et redémarre dès qu'un joueur arrive.

---

## Architecture

```
pyramid-game/
├── game.js          # Logique pure (deck, pyramide, contestations) — testé
├── server.js        # Serveur Node + Socket.io (état autoritaire)
├── tests/
│   └── game.test.js # Tests unitaires Jest
├── src/             # Client React (Vite)
│   ├── App.jsx
│   ├── socket.js
│   ├── gameUtils.js
│   └── components/
│       ├── Lobby.jsx         # Créer / rejoindre
│       ├── LobbyRoom.jsx     # Salle d'attente + réglages
│       ├── Countdown.jsx     # 3, 2, 1, GO !
│       ├── Memorize.jsx      # Phase mémorisation
│       ├── Pyramid.jsx       # Jeu principal
│       ├── Recitation.jsx    # Récitation finale (optionnel)
│       ├── Results.jsx       # Scores finaux
│       └── EventLog.jsx      # Journal des événements
├── public/
│   ├── manifest.json         # PWA
│   └── sw.js                 # Service worker
├── index.html
├── vite.config.js
├── nixpacks.toml             # Instructions build Railway
└── package.json
```

## Règles du jeu

Voir la description complète dans le code ou demande à l'IA 🃏

### Résumé rapide
1. L'hôte crée une partie → code à 4 lettres → les autres rejoignent
2. Chaque joueur reçoit 4 cartes à mémoriser (affichées N secondes)
3. L'hôte retourne les cartes de la pyramide une par une
4. Quand une carte est retournée, n'importe qui peut attaquer un autre joueur  
   en prétendant avoir cette valeur
5. La cible peut accepter (boire N gorgées) ou crier **MENTEUR !**  
   → l'attaquant choisit une position parmi ses 4 cartes face cachée  
   → si ça correspond : la cible boit 2N ; sinon : l'attaquant boit 2N
6. Option : remplacement de la carte révélée, récitation finale
