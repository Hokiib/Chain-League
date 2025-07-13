-- Migration 005: Corriger le type de la colonne price et ajouter blockchain_tx_hash
-- Date: 2025-07-13

-- Changer le type de la colonne price de INTEGER à DECIMAL(18,8)
ALTER TABLE shop_transactions ALTER COLUMN price TYPE DECIMAL(18,8);

-- Ajouter une colonne pour stocker le hash de transaction blockchain
ALTER TABLE shop_transactions ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);

-- Ajouter un index pour les recherches par hash de transaction
CREATE INDEX IF NOT EXISTS idx_shop_transactions_blockchain_tx_hash ON shop_transactions(blockchain_tx_hash);

-- Commentaire pour la documentation
COMMENT ON COLUMN shop_transactions.price IS 'Prix de l''item en CHZ (format décimal)';
COMMENT ON COLUMN shop_transactions.blockchain_tx_hash IS 'Hash de la transaction blockchain (optionnel)'; 