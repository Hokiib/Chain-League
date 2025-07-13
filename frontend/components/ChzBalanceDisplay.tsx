"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChzBalanceDisplayProps {
  chzBalance: number;
  className?: string;
}

export default function ChzBalanceDisplay({ chzBalance, className = "" }: ChzBalanceDisplayProps) {
  const { chzBalance: chzBalanceState } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await chzBalanceState.refreshBalance();
      toast({
        title: "Solde mis à jour",
        description: "Le solde CHZ a été actualisé",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le solde",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await chzBalanceState.switchToChilizNetwork();
      toast({
        title: "Réseau changé",
        description: "Basculement vers le réseau Chiliz testnet",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de basculer vers le réseau Chiliz",
        variant: "destructive",
      });
    }
  };



  // Assurer que displayBalance est un nombre valide
  const rawBalance = chzBalanceState.balance !== null && chzBalanceState.balance !== undefined && chzBalanceState.balance > 0 
    ? chzBalanceState.balance 
    : chzBalance;
  
  const displayBalance = typeof rawBalance === 'number' ? rawBalance : parseFloat(rawBalance) || 0;
  const isLoading = chzBalanceState.loading || isRefreshing;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Solde CHZ */}
      <div className="flex items-center space-x-2 bg-purple-600 rounded-full px-4 py-2">
        <div className="w-7 h-7 flex items-center justify-center">
          <img src="/chz-logo.webp" alt="CHZ" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center space-x-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <span className="text-white font-bold text-lg">
              {displayBalance % 1 === 0 ? `${displayBalance}.0` : displayBalance.toFixed(2)}
            </span>
          )}
          <span className="text-white font-medium text-sm">CHZ</span>
        </div>
      </div>

      {/* Statut du réseau */}
      {chzBalanceState.isOnCorrectNetwork ? (
        <Badge className="bg-green-600 text-white border-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Chiliz
        </Badge>
      ) : (
        <Button
          onClick={handleSwitchNetwork}
          size="sm"
          className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 h-6"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Basculer
        </Button>
      )}

      {/* Bouton de rafraîchissement */}
      <Button
        onClick={handleRefresh}
        size="sm"
        variant="ghost"
        className="w-8 h-8 p-0 text-gray-400 hover:text-white"
        disabled={isLoading}
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
} 