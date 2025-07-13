"use client"

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { isAuthenticated, loading, error } = useAuth();
  const { toast } = useToast();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !hasRedirected) {
      if (requireAuth && !isAuthenticated && !error) {
        // Rediriger vers la page de connexion seulement si pas d'erreur
        console.log('AuthGuard: Redirection vers la page de connexion');
        setHasRedirected(true);
        toast({
          title: "Authentification requise",
          description: "Veuillez vous connecter pour accéder à cette page",
          variant: "destructive",
          duration: 3000,
        });
        window.location.href = '/';
      } else if (!requireAuth && isAuthenticated) {
        // Rediriger vers la page principale si l'utilisateur est connecté et qu'on est sur la page de connexion
        console.log('AuthGuard: Redirection vers la page principale');
        setHasRedirected(true);
        toast({
          title: "Déjà connecté",
          description: "Redirection vers la page principale...",
          duration: 2000,
        });
        window.location.href = '/';
      }
    }
  }, [isAuthenticated, loading, requireAuth, error, toast, hasRedirected]);

  // Affichage de chargement pendant la vérification de l'authentification
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Si on exige une authentification et que l'utilisateur n'est pas connecté
  if (requireAuth && !isAuthenticated) {
    return null; // Ne rien afficher, la redirection se fait dans useEffect
  }

  // Si on ne veut pas d'authentification et que l'utilisateur est connecté
  if (!requireAuth && isAuthenticated) {
    return null; // Ne rien afficher, la redirection se fait dans useEffect
  }

  // Afficher le contenu protégé
  return <>{children}</>;
} 