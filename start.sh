#!/bin/bash

echo "🚀 Démarrage de Chain League..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js 18+"
    exit 1
fi

# Vérifier si PostgreSQL est en cours d'exécution
if ! pg_isready -q; then
    echo "❌ PostgreSQL n'est pas en cours d'exécution. Veuillez démarrer PostgreSQL"
    exit 1
fi

# Vérifier si Redis est en cours d'exécution
if ! redis-cli ping &> /dev/null; then
    echo "❌ Redis n'est pas en cours d'exécution. Veuillez démarrer Redis"
    exit 1
fi

echo "✅ Prérequis vérifiés"

# Démarrer le backend
echo "🔧 Démarrage du backend..."
cd "$(dirname "$0")"
npm start &
BACKEND_PID=$!

# Attendre que le backend soit prêt
echo "⏳ Attente du démarrage du backend..."
sleep 5

# Vérifier si le backend répond
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend démarré sur http://localhost:3000"
else
    echo "❌ Erreur lors du démarrage du backend"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Démarrer le frontend
echo "🎨 Démarrage du frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Attendre que le frontend soit prêt
echo "⏳ Attente du démarrage du frontend..."
sleep 10

# Vérifier si le frontend répond
if curl -s http://localhost:3001 > /dev/null; then
    echo "✅ Frontend démarré sur http://localhost:3001"
else
    echo "❌ Erreur lors du démarrage du frontend"
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 Chain League est prêt !"
echo ""
echo "📱 Frontend: http://localhost:3001"
echo "🔧 Backend:  http://localhost:3000"
echo "📚 API Docs: http://localhost:3000/api-docs"
echo ""
echo "🔐 Comptes de test:"
echo "   Admin: 0x1234567890123456789012345678901234567890"
echo "   Test:  0x9876543210987654321098765432109876543210"
echo ""
echo "💡 Utilisez Ctrl+C pour arrêter les serveurs"

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "🛑 Arrêt des serveurs..."
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    echo "✅ Serveurs arrêtés"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT

# Attendre indéfiniment
wait 