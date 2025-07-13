"use client"

import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { User, Wallet, Coins, Star } from 'lucide-react';

export default function MoralisUserInfo() {
  const { user } = useAuth();

  console.log('MoralisUserInfo - User data:', user);

  if (!user) {
    console.log('MoralisUserInfo - No user data');
    return null;
  }

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white">
              {user.username || 'Utilisateur inconnu'}
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Wallet className="h-3 w-3" />
              <span className="font-mono">
                {user.walletAddress
                  ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
                  : 'Adresse inconnue'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center space-x-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            <span className="font-bold text-yellow-400">{user.chzBalance || 0}</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <Star className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-purple-400">Niv. {user.level || 1}</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <Badge 
          variant={user.subscriptionStatus === 'premium' ? 'default' : 'secondary'}
          className={user.subscriptionStatus === 'premium' ? 'bg-purple-600' : 'bg-gray-600'}
        >
          {user.subscriptionStatus === 'premium' ? '⭐ Premium' : 'Basic'}
        </Badge>
        
        <div className="text-xs text-gray-400">
          XP: {user.xp || 0}
        </div>
      </div>
    </div>
  );
} 