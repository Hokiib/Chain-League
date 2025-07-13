-- Migration 004: Tables pour la boutique
-- Date: 2025-07-12

-- Table pour l'inventaire des joueurs
CREATE TABLE IF NOT EXISTS player_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('boost', 'cosmetic', 'subscription')),
    quantity INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, item_id)
);

-- Table pour les transactions de la boutique
CREATE TABLE IF NOT EXISTS shop_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'refund', 'gift')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_player_inventory_player_id ON player_inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_item_id ON player_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_expires_at ON player_inventory(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_transactions_player_id ON shop_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_shop_transactions_created_at ON shop_transactions(created_at);

-- Ajouter les colonnes manquantes à la table players si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter subscription_expires_at si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'subscription_expires_at') THEN
        ALTER TABLE players ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Commentaires pour la documentation
COMMENT ON TABLE player_inventory IS 'Inventaire des items achetés par les joueurs';
COMMENT ON TABLE shop_transactions IS 'Historique des transactions de la boutique';
COMMENT ON COLUMN player_inventory.item_id IS 'ID unique de l''item (ex: attack_boost, golden_crown)';
COMMENT ON COLUMN player_inventory.item_type IS 'Type d''item: boost, cosmetic, subscription';
COMMENT ON COLUMN player_inventory.expires_at IS 'Date d''expiration pour les items temporaires';
COMMENT ON COLUMN player_inventory.is_active IS 'Si l''item est actuellement actif (pour les boosts)';
COMMENT ON COLUMN shop_transactions.transaction_type IS 'Type de transaction: purchase, refund, gift'; 