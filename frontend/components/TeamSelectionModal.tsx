"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TEAMS } from '@/lib/types';
import { Loader2, User, Users, Crown } from 'lucide-react';
import TeamLogo from './team-logo';

interface TeamSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string, teamId: string) => Promise<void>;
  walletAddress: string;
}

export function TeamSelectionModal({ isOpen, onClose, onSubmit, walletAddress }: TeamSelectionModalProps) {
  const [username, setUsername] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    team?: string;
  }>({});

  const validateUsername = (value: string) => {
    if (!value) return 'Le nom d\'utilisateur est requis';
    if (value.length < 3) return 'Le nom d\'utilisateur doit faire au moins 3 caractères';
    if (value.length > 20) return 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, underscores (_) et tirets (-)';
    }
    return null;
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    const error = validateUsername(value);
    setErrors(prev => ({ ...prev, username: error || undefined }));
  };

  const handleTeamSelect = (teamId: string) => {
    setSelectedTeam(teamId);
    setErrors(prev => ({ ...prev, team: undefined }));
  };

  const handleSubmit = async () => {
    // Validation
    const usernameError = validateUsername(username);
    const teamError = !selectedTeam ? 'Veuillez sélectionner une équipe' : null;

    if (usernameError || teamError) {
      setErrors({
        username: usernameError || undefined,
        team: teamError || undefined,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(username, selectedTeam!);
      // Le modal sera fermé par le parent après succès
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      // L'erreur sera gérée par le parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white text-center">
            Créer votre compte
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center">
            Bienvenue ! Configurez votre profil pour commencer à jouer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Adresse wallet */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Adresse wallet</div>
                <div className="text-white font-mono text-sm">{formatWalletAddress(walletAddress)}</div>
              </div>
            </div>
          </div>

          {/* Nom d'utilisateur */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white font-medium">
              Nom d'utilisateur
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Entrez votre nom d'utilisateur"
              className="bg-gray-800 border-gray-700 text-white rounded-xl h-12"
              disabled={isSubmitting}
            />
            {errors.username && (
              <p className="text-red-400 text-sm">{errors.username}</p>
            )}
            <p className="text-gray-500 text-xs">
              3-20 caractères, lettres, chiffres, underscores (_) et tirets (-) uniquement
            </p>
          </div>

          {/* Sélection d'équipe */}
          <div className="space-y-3">
            <Label className="text-white font-medium">
              Choisissez votre équipe
            </Label>
            {errors.team && (
              <p className="text-red-400 text-sm">{errors.team}</p>
            )}
            <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
              {TEAMS.map((team) => (
                <div
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  className={`bg-gray-800 rounded-xl p-4 border-2 cursor-pointer transition-all hover:bg-gray-750 ${
                    selectedTeam === team.id
                      ? 'border-purple-500 bg-purple-600/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                      style={{
                        backgroundColor: `${team.color}20`,
                        borderColor: `${team.color}50`,
                      }}
                    >
                      <TeamLogo logo={team.logo} name={team.name} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white">{team.name}</h3>
                        {selectedTeam === team.id && (
                          <Badge className="bg-purple-600 text-white">
                            Sélectionné
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-sm text-gray-400 mt-1">
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>{team.subscribers.toLocaleString()} fans</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Crown className="h-3 w-3" />
                          <span>Ligue {Math.floor(Math.random() * 3) + 1}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bonus de départ */}
          <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-green-400 font-medium">Bonus de départ</div>
                <div className="text-sm text-gray-300">
                  1000 CHZ + Pack de démarrage gratuit
                </div>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 rounded-xl bg-transparent"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !username || !selectedTeam}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl font-bold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer mon compte'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 