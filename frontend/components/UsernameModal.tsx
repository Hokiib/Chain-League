'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (username: string) => void;
  walletAddress: string;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  walletAddress,
}) => {
  const [username, setUsername] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation en temps réel
  useEffect(() => {
    if (!username) {
      setIsValid(false);
      setError('');
      return;
    }

    if (username.length < 3) {
      setIsValid(false);
      setError('Le nom d\'utilisateur doit faire au moins 3 caractères');
      return;
    }

    if (username.length > 20) {
      setIsValid(false);
      setError('Le nom d\'utilisateur ne peut pas dépasser 20 caractères');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setIsValid(false);
      setError('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, underscores (_) et tirets (-)');
      return;
    }

    setIsValid(true);
    setError('');
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(username);
      // Ne pas remettre isSubmitting à false car le modal va se fermer
    } catch (error) {
      console.error('Erreur lors de la création du compte:', error);
      setIsSubmitting(false); // Remettre à false seulement en cas d'erreur
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !isSubmitting) {
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            Créer votre compte
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Adresse wallet :</p>
            <p className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
              {walletAddress}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Entrez votre nom d'utilisateur"
                  className={`pr-10 ${
                    username && (isValid ? 'border-green-500' : 'border-red-500')
                  }`}
                  autoFocus
                />
                {username && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Règles pour le nom d'utilisateur :</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Entre 3 et 20 caractères</li>
                  <li>Lettres (a-z, A-Z)</li>
                  <li>Chiffres (0-9)</li>
                  <li>Tirets (-) et underscores (_)</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? 'Création...' : 'Créer le compte'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 