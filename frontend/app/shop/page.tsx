"use client"

import { useState, useEffect, useRef } from "react"

// Déclaration TypeScript pour window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import Navigation from "@/components/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import { shopService } from "@/lib/api"
import { Coins, Zap, Clock, Shield, Sword, Crown, Star, Loader2, ShoppingCart, Package, History } from "lucide-react"

export default function ShopPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const { toast } = useToast();
  const [shopItems, setShopItems] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const loadingRef = useRef(false);

  // Charger les items de la boutique et l'inventaire
  useEffect(() => {
    if (isAuthenticated && user && !loadingRef.current) {
      loadShopData();
    } else if (!loading && !isAuthenticated) {
      // Si l'utilisateur n'est pas connecté et que le loading est terminé, arrêter le loading des items
      setLoadingItems(false);
    }
  }, [isAuthenticated, user?.id, loading]); // Utiliser user.id au lieu de user pour éviter les rechargements inutiles

  const loadShopData = async () => {
    if (loadingRef.current) return; // Éviter les appels multiples
    
    try {
      loadingRef.current = true;
      setIsLoadingData(true);
      setLoadingItems(true);
      
      const [itemsData, inventoryData] = await Promise.all([
        shopService.getItems(),
        shopService.getInventory()
      ]);
      
      setShopItems(itemsData);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Erreur lors du chargement des données de la boutique:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de la boutique",
        variant: "destructive",
      });
    } finally {
      setLoadingItems(false);
      setIsLoadingData(false);
      loadingRef.current = false;
    }
  };

  // Si en cours de chargement, afficher un loader
  if (loading || loadingItems) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher un message mais ne pas rediriger
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
        <Header chzBalance={0} />
        <div className="px-4 py-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-white mb-2">Boutique</h1>
            <p className="text-gray-400">Connectez-vous pour accéder à la boutique</p>
            <div className="bg-gray-900/50 rounded-2xl border border-gray-700 p-6 max-w-md mx-auto">
              <p className="text-gray-300 mb-4">Vous devez être connecté pour voir les articles de la boutique.</p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Se connecter
              </Button>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  // Fonction pour acheter un item
  const handlePurchase = async (item: any, itemType: string) => {
    if (!user || purchasing || isLoadingData) return;

    setPurchasing(item.id);
    try {
      const result = await shopService.purchaseItem(item.id, itemType);
      
      // Si le backend demande une transaction blockchain réelle
      if (result.requiresBlockchainTransaction) {
        toast({
          title: "Transaction blockchain requise",
          description: `Envoyez ${result.transactionDetails.amount} CHZ à l'adresse du shop pour finaliser l'achat`,
        });

        // Déclencher une transaction blockchain via le wallet connecté
        if (window.ethereum) {
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
              const transactionParameters = {
                to: result.transactionDetails.recipient,
                from: accounts[0],
                value: '0x' + (result.transactionDetails.amount * Math.pow(10, 18)).toString(16), // Convertir en wei
                gas: '0x5208', // 21000 en hexadécimal
              };

              const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [transactionParameters],
              });

              toast({
                title: "Transaction envoyée !",
                description: `Transaction hash: ${txHash}`,
              });

              // Confirmer l'achat avec le hash de transaction
              await shopService.confirmPurchase(item.id, itemType, txHash);
              
              toast({
                title: "Achat confirmé !",
                description: `${item.name} a été ajouté à votre inventaire`,
              });
            } else {
              toast({
                title: "Erreur",
                description: "Aucun compte wallet connecté",
                variant: "destructive",
              });
            }
          } catch (txError: any) {
            console.error('Erreur de transaction:', txError);
            toast({
              title: "Erreur de transaction",
              description: txError.message || "Erreur lors de la transaction blockchain",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Erreur",
            description: "Wallet non détecté. Veuillez installer MetaMask ou un wallet compatible",
            variant: "destructive",
          });
        }
      } else {
        // Achat simulé réussi (ancien comportement)
        toast({
          title: "Achat réussi !",
          description: `${item.name} a été ajouté à votre inventaire`,
        });
      }

      // Recharger les données seulement si pas déjà en cours
      if (!isLoadingData) {
        await loadShopData();
      }
      
    } catch (error: any) {
      console.error('Erreur lors de l\'achat:', error);
      toast({
        title: "Erreur d'achat",
        description: error.response?.data?.error || "Erreur lors de l'achat",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  // Fonction pour formater la durée
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}j`;
  };

  // Fonction pour obtenir l'icône
  const getIcon = (iconName: string) => {
    const icons: { [key: string]: any } = {
      sword: Sword,
      shield: Shield,
      zap: Zap,
      star: Star,
      crown: Crown,
    };
    return icons[iconName] || Star;
  };

  // Fonction pour obtenir la couleur
  const getColor = (color: string) => {
    const colors: { [key: string]: string } = {
      red: "text-red-400",
      blue: "text-blue-400",
      yellow: "text-yellow-400",
      purple: "text-purple-400",
      green: "text-green-400",
    };
    return colors[color] || "text-gray-400";
  };

  // Fonction pour obtenir la couleur de fond
  const getBgColor = (color: string) => {
    const colors: { [key: string]: string } = {
      red: "bg-red-600/20",
      blue: "bg-blue-600/20",
      yellow: "bg-yellow-600/20",
      purple: "bg-purple-600/20",
      green: "bg-green-600/20",
    };
    return colors[color] || "bg-gray-600/20";
  };

  // Fonction pour obtenir la couleur de bordure
  const getBorderColor = (color: string) => {
    const colors: { [key: string]: string } = {
      red: "border-red-500/50",
      blue: "border-blue-500/50",
      yellow: "border-yellow-500/50",
      purple: "border-purple-500/50",
      green: "border-green-500/50",
    };
    return colors[color] || "border-gray-500/50";
  };

  // Fonction pour activer un boost
  const handleActivateBoost = async (itemId: string) => {
    if (isLoadingData) return; // Éviter les appels multiples
    
    try {
      await shopService.activateBoost(itemId);
      toast({
        title: "Boost activé !",
        description: "Le boost a été activé avec succès",
      });
      // Recharger les données seulement si pas déjà en cours
      if (!isLoadingData) {
        await loadShopData();
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'activation du boost:', error);
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Erreur lors de l'activation du boost",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 sm:pb-24">
      <Header chzBalance={user?.chzBalance || 0} />

      <div className="px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Boutique</h1>
          <p className="text-gray-400">Améliorez votre expérience de jeu</p>
        </div>

        <Tabs defaultValue="boosts" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-900 rounded-2xl h-14 mb-6">
            <TabsTrigger
              value="boosts"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold text-sm"
            >
              <Zap className="h-4 w-4 mr-1" />
              Boosts
            </TabsTrigger>
            <TabsTrigger
              value="cosmetics"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold text-sm"
            >
              <Star className="h-4 w-4 mr-1" />
              Cosmétiques
            </TabsTrigger>
            <TabsTrigger
              value="premium"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold text-sm"
            >
              <Crown className="h-4 w-4 mr-1" />
              Premium
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-xl font-bold text-sm"
            >
              <Package className="h-4 w-4 mr-1" />
              Inventaire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boosts" className="space-y-4">
            <div className="grid gap-4">
              {shopItems?.boosts?.map((boost: any) => {
                const Icon = getIcon(boost.icon);
                const ownedItem = inventory?.boosts?.find((item: any) => item.id === boost.id);
                const isOwned = ownedItem && ownedItem.quantity > 0;
                
                return (
                  <div key={boost.id} className={`bg-gray-900 rounded-3xl border-2 ${getBorderColor(boost.color)} p-6`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-16 h-16 ${getBgColor(boost.color)} rounded-2xl flex items-center justify-center border-2 ${getBorderColor(boost.color)}`}
                        >
                          <Icon className={`h-8 w-8 ${getColor(boost.color)}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-xl">{boost.name}</h3>
                          <p className="text-gray-400 text-sm">{boost.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge className="bg-gray-700 text-gray-300 text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(boost.duration)}
                            </Badge>
                            {isOwned && (
                              <Badge className="bg-green-600 text-white text-xs">
                                Possédé ({ownedItem.quantity})
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Coins className="h-5 w-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-yellow-400">{boost.price}</span>
                        <span className="text-gray-400">CHZ</span>
                      </div>
                      <Button
                        onClick={() => handlePurchase(boost, "boosts")}
                        disabled={purchasing === boost.id}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 px-8 rounded-2xl font-bold disabled:opacity-50"
                      >
                        {purchasing === boost.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          isOwned ? "Acheter +" : "Acheter"
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="cosmetics" className="space-y-4">
            <div className="grid gap-4">
              {shopItems?.cosmetics?.map((cosmetic: any) => {
                const Icon = getIcon(cosmetic.icon);
                const ownedItem = inventory?.cosmetics?.find((item: any) => item.id === cosmetic.id);
                const isOwned = ownedItem && ownedItem.quantity > 0;
                
                return (
                  <div key={cosmetic.id} className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
                          <Icon className={`h-8 w-8 ${getColor(cosmetic.color)}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-xl">{cosmetic.name}</h3>
                          <p className="text-gray-400 text-sm">{cosmetic.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge className="bg-purple-600 text-white text-xs">{cosmetic.rarity}</Badge>
                            <Badge className="bg-gray-700 text-gray-300 text-xs">{cosmetic.type}</Badge>
                            {isOwned && (
                              <Badge className="bg-green-600 text-white text-xs">
                                Possédé ({ownedItem.quantity})
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Coins className="h-5 w-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-yellow-400">{cosmetic.price}</span>
                        <span className="text-gray-400">CHZ</span>
                      </div>
                      <Button
                        onClick={() => handlePurchase(cosmetic, "cosmetics")}
                        disabled={purchasing === cosmetic.id}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-12 px-8 rounded-2xl font-bold disabled:opacity-50"
                      >
                        {purchasing === cosmetic.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          isOwned ? "Acheter +" : "Acheter"
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="premium" className="space-y-4">
            <div className="grid gap-6">
              {shopItems?.subscriptions?.map((sub: any) => {
                const ownedItem = inventory?.subscriptions?.find((item: any) => item.id === sub.id);
                const isOwned = ownedItem && ownedItem.quantity > 0;
                const isActive = ownedItem && !ownedItem.isExpired;
                
                return (
                  <div
                    key={sub.id}
                    className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl border-2 border-yellow-500/50 p-6"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl flex items-center justify-center">
                          <Crown className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-2xl">{sub.name}</h3>
                          <p className="text-gray-400">{sub.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge className="bg-yellow-600 text-white">{formatDuration(sub.duration)}</Badge>
                            {isOwned && (
                              <Badge className={isActive ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                                {isActive ? "Actif" : "Expiré"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      {Object.entries(sub.effect).map(([key, value]: [string, any], index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-300">
                            {key === 'chzBonus' && `+${Math.round((value - 1) * 100)}% CHZ bonus`}
                            {key === 'allBoosts' && value && "Tous les boosts inclus"}
                            {key === 'priorityAccess' && value && "Accès prioritaire"}
                            {key === 'exclusiveCosmetics' && value && "Cosmétiques exclusifs"}
                            {key === 'vipBadge' && value && "Badge VIP"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Coins className="h-6 w-6 text-yellow-400" />
                        <span className="text-3xl font-bold text-yellow-400">{sub.price}</span>
                        <span className="text-gray-400">CHZ</span>
                      </div>
                      <Button
                        onClick={() => handlePurchase(sub, "subscriptions")}
                        disabled={purchasing === sub.id}
                        className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 h-14 px-10 rounded-2xl font-bold text-lg disabled:opacity-50"
                      >
                        {purchasing === sub.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          isActive ? "Renouveler" : "S'abonner"
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
          <TabsContent value="inventory" className="space-y-4">
            <div className="space-y-6">
              {/* Boosts */}
              {inventory?.boosts && inventory.boosts.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-purple-400" />
                    Mes Boosts
                  </h3>
                  <div className="grid gap-4">
                    {inventory.boosts.map((boost: any) => {
                      const Icon = getIcon(boost.icon);
                      return (
                        <div key={boost.id} className={`bg-gray-900 rounded-3xl border-2 ${getBorderColor(boost.color)} p-6`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-16 h-16 ${getBgColor(boost.color)} rounded-2xl flex items-center justify-center border-2 ${getBorderColor(boost.color)}`}>
                                <Icon className={`h-8 w-8 ${getColor(boost.color)}`} />
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-lg">{boost.name}</h4>
                                <p className="text-gray-400 text-sm">{boost.description}</p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <Badge className="bg-gray-700 text-gray-300 text-xs">
                                    Quantité: {boost.quantity}
                                  </Badge>
                                  {boost.expiresAt && (
                                    <Badge className={boost.isExpired ? "bg-red-600 text-white text-xs" : "bg-green-600 text-white text-xs"}>
                                      {boost.isExpired ? "Expiré" : "Actif"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {!boost.isExpired && boost.expiresAt && (
                              <Button
                                onClick={() => handleActivateBoost(boost.id)}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-10 px-6 rounded-xl font-bold"
                              >
                                Activer
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cosmétiques */}
              {inventory?.cosmetics && inventory.cosmetics.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Star className="h-5 w-5 mr-2 text-purple-400" />
                    Mes Cosmétiques
                  </h3>
                  <div className="grid gap-4">
                    {inventory.cosmetics.map((cosmetic: any) => {
                      const Icon = getIcon(cosmetic.icon);
                      return (
                        <div key={cosmetic.id} className="bg-gray-900 rounded-3xl border border-gray-800 p-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center">
                              <Icon className={`h-8 w-8 ${getColor(cosmetic.color)}`} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">{cosmetic.name}</h4>
                              <p className="text-gray-400 text-sm">{cosmetic.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge className="bg-purple-600 text-white text-xs">{cosmetic.rarity}</Badge>
                                <Badge className="bg-gray-700 text-gray-300 text-xs">
                                  Quantité: {cosmetic.quantity}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Abonnements */}
              {inventory?.subscriptions && inventory.subscriptions.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Crown className="h-5 w-5 mr-2 text-purple-400" />
                    Mes Abonnements
                  </h3>
                  <div className="grid gap-4">
                    {inventory.subscriptions.map((sub: any) => (
                      <div key={sub.id} className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl border-2 border-yellow-500/50 p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl flex items-center justify-center">
                              <Crown className="h-8 w-8 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-lg">{sub.name}</h4>
                              <p className="text-gray-400 text-sm">{sub.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge className={sub.isExpired ? "bg-red-600 text-white text-xs" : "bg-green-600 text-white text-xs"}>
                                  {sub.isExpired ? "Expiré" : "Actif"}
                                </Badge>
                                {sub.expiresAt && (
                                  <Badge className="bg-gray-700 text-gray-300 text-xs">
                                    Expire: {new Date(sub.expiresAt).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventaire vide */}
              {(!inventory || 
                (inventory.boosts?.length === 0 && 
                 inventory.cosmetics?.length === 0 && 
                 inventory.subscriptions?.length === 0)) && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-400 mb-2">Inventaire vide</h3>
                  <p className="text-gray-500">Achetez des items dans la boutique pour les voir ici</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Navigation />
    </div>
  )
}
