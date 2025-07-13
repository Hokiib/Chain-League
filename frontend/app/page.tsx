"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import WalletConnect from "@/components/WalletConnect"
import MoralisUserInfo from "@/components/MoralisUserInfo"
import TeamLogo from "@/components/team-logo"
import { useAuth } from "@/hooks/useAuth"
import { teamsService, gameService, type Team, type GameSession } from "@/lib/api"
import { Play, Users, Clock, Crown, TrendingUp, Zap, Calendar, Bell, Loader2 } from "lucide-react"

// Composant pour la page principale (utilisateur connecté)
function HomePageContent() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Charger les données au montage
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const [teamsData, sessionData] = await Promise.all([
          teamsService.getTeams(),
          gameService.getCurrentSession().catch(() => null)
        ]);
        setTeams(teamsData);
        setCurrentSession(sessionData);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Affichage de chargement
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  const getCurrentTeam = () => {
    if (!Array.isArray(teams)) return null;
    return teams.find((t) => t.id === user?.teamId);
  };
  const getTeamById = (id: string) => {
    if (!Array.isArray(teams)) return null;
    return teams.find((t) => t.id === id);
  };

  // Scores simulés pour chaque équipe
  const getTeamScores = () => {
    if (!Array.isArray(teams)) {
      console.warn('teams is not an array:', teams);
      return [];
    }
    return teams
      .map((team) => ({
        ...team,
        territories: Math.floor(Math.random() * 25) + 5,
        players: Math.floor(Math.random() * 200) + 50,
      }))
      .sort((a, b) => b.territories - a.territories);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const teamScores = getTeamScores();
  const leader = teamScores[0];

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={user?.chzBalance || 0} />

      <div className="px-4 py-6 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Bienvenue dans Chain League
          </h1>
          <p className="text-gray-400 text-lg">
            Dominez la carte avec {getCurrentTeam()?.name || "votre équipe"} !
          </p>
          {user && (
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
              <span>Connecté en tant que {user.username}</span>
              <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                {user.subscriptionStatus}
              </Badge>
            </div>
          )}
        </div>

        {/* Moralis User Info */}
        {user && <MoralisUserInfo />}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <div className="text-2xl font-bold text-purple-400">{user?.level || 1}</div>
            <div className="text-sm text-gray-400">Niveau</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <div className="text-2xl font-bold text-blue-400">#{Math.floor(Math.random() * 100) + 1}</div>
            <div className="text-sm text-gray-400">Classement</div>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
            <div className="text-2xl font-bold text-green-400">{Math.floor(Math.random() * 50) + 10}</div>
            <div className="text-sm text-gray-400">Victoires</div>
          </div>
        </div>

        {/* Session en cours */}
        {currentSession && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Session en cours</h2>
              <Badge className="bg-green-600 text-white">
                <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                {currentSession.status.toUpperCase()}
              </Badge>
            </div>

            <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-xl">Session #{currentSession.id}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Depuis {formatTimeAgo(currentSession.start_time)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{currentSession.total_players} joueurs</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/game">
                    <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 px-6 rounded-2xl font-bold">
                      <Play className="mr-2 h-5 w-5" />
                      Rejoindre
                    </Button>
                  </Link>
                </div>

                {/* Leader actuel */}
                {leader && (
                  <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-4 border border-yellow-500/30 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-6 w-6 text-yellow-400" />
                        <TeamLogo logo={leader.logo} name={leader.name} size={32} />
                        <div>
                          <div className="font-bold text-white">{leader.name}</div>
                          <div className="text-sm text-yellow-400">En tête</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{leader.territories}</div>
                        <div className="text-sm text-gray-400">territoires</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 3 */}
                <div className="space-y-3">
                  {teamScores.slice(0, 3).map((team, index) => (
                    <div key={team.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                            index === 0
                              ? "bg-yellow-600 text-white"
                              : index === 1
                                ? "bg-gray-400 text-white"
                                : "bg-orange-600 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <TeamLogo logo={team.logo} name={team.name} size={24} />
                        <span className="font-medium text-white">{team.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-bold text-white">{team.territories}</div>
                          <div className="text-xs text-gray-400">zones</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-purple-400">{team.players}</div>
                          <div className="text-xs text-gray-400">joueurs</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation rapide */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/game">
            <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-16 rounded-2xl font-bold">
              <Play className="mr-2 h-6 w-6" />
              Jouer
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button variant="outline" className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-600/20 h-16 rounded-2xl font-bold bg-transparent">
              <TrendingUp className="mr-2 h-6 w-6" />
              Classement
            </Button>
          </Link>
        </div>
      </div>

      <Navigation />
    </div>
  );
}

// Page principale avec gestion de l'authentification
export default function HomePage() {
  const { isAuthenticated, loading, error } = useAuth();

  console.log('HomePage - État:', { isAuthenticated, loading, error });

  // Si en cours de chargement, afficher un loader
  if (loading) {
    console.log('HomePage - Affichage du loader');
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher la page de connexion
  // (même s'il y a une erreur, on reste sur la page de connexion pour voir l'erreur)
  if (!isAuthenticated) {
    console.log('HomePage - Affichage de la page de connexion');
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
              Chain League
            </h1>
            <p className="text-gray-400 text-lg">
              Le jeu de stratégie Web3 où vous dominez la carte avec votre équipe
            </p>
          </div>
          <WalletConnect />
        </div>
      </div>
    );
  }

  // Si l'utilisateur est connecté, afficher la page principale
  console.log('HomePage - Affichage de la page principale');
  return <HomePageContent />;
}
