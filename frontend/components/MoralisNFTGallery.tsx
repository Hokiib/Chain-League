"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { MoralisNFTService, NFTMetadata, TokenBalance } from '@/lib/moralis-nft';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Coins, Image, Star, Trophy } from 'lucide-react';

export default function MoralisNFTGallery() {
  const { user } = useAuth();
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.walletAddress) {
      loadUserAssets();
    }
  }, [user?.walletAddress]);

  const loadUserAssets = async () => {
    if (!user?.walletAddress) return;

    setLoading(true);
    try {
      // Charger les NFTs et tokens (simulation pour le développement)
      const userNFTs = await MoralisNFTService.getMockChainLeagueNFTs(user.walletAddress);
      const userTokens = await MoralisNFTService.getMockGameTokens(user.walletAddress);
      
      setNfts(userNFTs);
      setTokens(userTokens);
    } catch (error) {
      console.error('Erreur lors du chargement des assets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Mes Assets Web3</h2>
        <Badge variant="outline" className="border-purple-500/50 text-purple-400">
          🔥 Powered by Moralis
        </Badge>
      </div>

      <Tabs defaultValue="nfts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-900/50">
          <TabsTrigger value="nfts" className="data-[state=active]:bg-purple-600">
            <Image className="h-4 w-4 mr-2" />
            NFTs ({nfts.length})
          </TabsTrigger>
          <TabsTrigger value="tokens" className="data-[state=active]:bg-purple-600">
            <Coins className="h-4 w-4 mr-2" />
            Tokens ({tokens.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nfts" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : nfts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nfts.map((nft) => (
                <Card key={`${nft.token_address}-${nft.token_id}`} className="bg-gray-900/50 border-gray-700">
                  <CardHeader className="pb-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                      <img
                        src={nft.metadata.image}
                        alt={nft.metadata.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TkZUIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
                        }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-white">
                        {nft.metadata.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {nft.symbol}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {nft.metadata.description}
                    </p>
                    {nft.metadata.attributes && (
                      <div className="flex flex-wrap gap-1">
                        {nft.metadata.attributes.slice(0, 3).map((attr, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {attr.trait_type}: {attr.value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun NFT trouvé</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : tokens.length > 0 ? (
            <div className="space-y-3">
              {tokens.map((token) => (
                <Card key={token.token_address} className="bg-gray-900/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                          <img
                            src={token.logo}
                            alt={token.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjIwIiB5PSIyMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlQ8L3RleHQ+Cjwvc3ZnPgo=';
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-white">{token.name}</div>
                          <div className="text-sm text-gray-400">{token.symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">
                          {parseFloat(token.balance_formatted).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400">
                          ${token.usd_value.toFixed(2)}
                        </div>
                        {token.usd_price_24hr_percent_change !== 0 && (
                          <div className={`text-xs ${
                            token.usd_price_24hr_percent_change > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {token.usd_price_24hr_percent_change > 0 ? '+' : ''}
                            {token.usd_price_24hr_percent_change.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun token trouvé</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 