import Moralis from 'moralis';
import { initializeMoralis, MORALIS_CONFIG } from './moralis';

export interface NFTMetadata {
  token_address: string;
  token_id: string;
  amount: string;
  token_hash: string;
  block_number_minted: string;
  updated_at: string;
  contract_type: string;
  name: string;
  symbol: string;
  token_uri: string;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
  last_token_uri_sync: string;
  last_metadata_sync: string;
}

export interface TokenBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo: string;
  thumbnail: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  total_supply: string;
  total_supply_formatted: string;
  percentage_relative_to_total_supply: string;
  balance_formatted: string;
  usd_price: number;
  usd_price_24hr_percent_change: number;
  usd_price_24hr_usd_change: number;
  usd_value: number;
  usd_value_24hr_usd_change: number;
  native_token: boolean;
  portfolio_percentage: number;
}

export class MoralisNFTService {
  static async getUserNFTs(walletAddress: string, chain: string = 'chiliz'): Promise<NFTMetadata[]> {
    await initializeMoralis();
    
    // Mode développement : utiliser les données simulées
    if (!MORALIS_CONFIG.apiKey || MORALIS_CONFIG.apiKey === 'development_key') {
      console.log('Mode développement : NFTs simulés');
      return this.getMockChainLeagueNFTs(walletAddress);
    }
    
    try {
      const response = await Moralis.EvmApi.nft.getWalletNFTs({
        address: walletAddress,
        chain: chain as any,
      });

      return response.result || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des NFTs:', error);
      return [];
    }
  }

  static async getTokenBalances(walletAddress: string, chain: string = 'chiliz'): Promise<TokenBalance[]> {
    await initializeMoralis();
    
    // Mode développement : utiliser les données simulées
    if (!MORALIS_CONFIG.apiKey || MORALIS_CONFIG.apiKey === 'development_key') {
      console.log('Mode développement : tokens simulés');
      return this.getMockGameTokens(walletAddress);
    }
    
    try {
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: walletAddress,
        chain: chain as any,
      });

      return response.result || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
      return [];
    }
  }

  static async getNFTMetadata(contractAddress: string, tokenId: string, chain: string = 'chiliz'): Promise<NFTMetadata | null> {
    await initializeMoralis();
    
    try {
      const response = await Moralis.EvmApi.nft.getNFTMetadata({
        address: contractAddress,
        tokenId: tokenId,
        chain: chain as any,
      });

      return response.result || null;
    } catch (error) {
      console.error('Erreur lors de la récupération des métadonnées NFT:', error);
      return null;
    }
  }

  static async getNFTTransfers(walletAddress: string, chain: string = 'chiliz'): Promise<any[]> {
    await initializeMoralis();
    
    try {
      const response = await Moralis.EvmApi.nft.getWalletNFTTransfers({
        address: walletAddress,
        chain: chain as any,
      });

      return response.result || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des transferts NFT:', error);
      return [];
    }
  }

  // Fonctions spécifiques pour Chain League
  static async getChainLeagueNFTs(walletAddress: string): Promise<NFTMetadata[]> {
    const allNFTs = await this.getUserNFTs(walletAddress);
    
    // Filtrer les NFTs spécifiques à Chain League
    // En production, vous auriez des contrats spécifiques
    return allNFTs.filter(nft => 
      nft.name?.toLowerCase().includes('chain league') ||
      nft.symbol?.toLowerCase().includes('cl') ||
      nft.metadata?.name?.toLowerCase().includes('chain league')
    );
  }

  static async getGameTokens(walletAddress: string): Promise<TokenBalance[]> {
    const allTokens = await this.getTokenBalances(walletAddress);
    
    // Filtrer les tokens de jeu (CHZ, etc.)
    return allTokens.filter(token => 
      token.symbol?.toLowerCase() === 'chz' ||
      token.name?.toLowerCase().includes('chain league') ||
      token.symbol?.toLowerCase().includes('cl')
    );
  }

  // Simulation pour le développement
  static async getMockChainLeagueNFTs(walletAddress: string): Promise<NFTMetadata[]> {
    return [
      {
        token_address: '0x1234567890123456789012345678901234567890',
        token_id: '1',
        amount: '1',
        token_hash: '0xabc123',
        block_number_minted: '12345678',
        updated_at: new Date().toISOString(),
        contract_type: 'ERC721',
        name: 'Chain League Player',
        symbol: 'CLP',
        token_uri: 'https://api.chainleague.com/nft/1',
        metadata: {
          name: 'Chain League Player #1',
          description: 'Un joueur légendaire de Chain League',
          image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q0xQIDE8L3RleHQ+Cjwvc3ZnPgo=',
          attributes: [
            { trait_type: 'Level', value: '12' },
            { trait_type: 'Team', value: 'Red Dragons' },
            { trait_type: 'Rarity', value: 'Legendary' },
          ],
        },
        last_token_uri_sync: new Date().toISOString(),
        last_metadata_sync: new Date().toISOString(),
      },
      {
        token_address: '0x1234567890123456789012345678901234567890',
        token_id: '2',
        amount: '1',
        token_hash: '0xdef456',
        block_number_minted: '12345679',
        updated_at: new Date().toISOString(),
        contract_type: 'ERC721',
        name: 'Chain League Stadium',
        symbol: 'CLS',
        token_uri: 'https://api.chainleague.com/nft/2',
        metadata: {
          name: 'Chain League Stadium #1',
          description: 'Un stade majestueux pour les batailles',
          image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMTBiOTgxIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q0xTIDE8L3RleHQ+Cjwvc3ZnPgo=',
          attributes: [
            { trait_type: 'Capacity', value: '50000' },
            { trait_type: 'Type', value: 'Arena' },
            { trait_type: 'Rarity', value: 'Epic' },
          ],
        },
        last_token_uri_sync: new Date().toISOString(),
        last_metadata_sync: new Date().toISOString(),
      },
    ];
  }

  static async getMockGameTokens(walletAddress: string): Promise<TokenBalance[]> {
    return [
      {
        token_address: '0x3506424f91fd33084466f402d5d97f05f8e3b4af',
        name: 'Chiliz',
        symbol: 'CHZ',
        logo: 'https://cryptologos.cc/logos/chiliz-chz-logo.png',
        thumbnail: 'https://cryptologos.cc/logos/chiliz-chz-logo.png',
        decimals: 18,
        balance: '1000000000000000000000',
        possible_spam: false,
        verified_contract: true,
        total_supply: '8888888888888888888888888888',
        total_supply_formatted: '8888888888888888888888888888',
        percentage_relative_to_total_supply: '0.0000000000000000000000000001',
        balance_formatted: '1000',
        usd_price: 0.15,
        usd_price_24hr_percent_change: 2.5,
        usd_price_24hr_usd_change: 0.00375,
        usd_value: 150,
        usd_value_24hr_usd_change: 3.75,
        native_token: false,
        portfolio_percentage: 100,
      },
    ];
  }
} 