-- Migration 006: Mettre à jour les types de transaction autorisés
-- Date: 2025-07-13

-- Supprimer l'ancienne contrainte
ALTER TABLE shop_transactions DROP CONSTRAINT IF EXISTS shop_transactions_transaction_type_check;

-- Ajouter la nouvelle contrainte avec purchase_pending
ALTER TABLE shop_transactions ADD CONSTRAINT shop_transactions_transaction_type_check 
    CHECK (transaction_type IN ('purchase', 'purchase_pending', 'refund', 'gift'));

-- Commentaire pour la documentation
COMMENT ON CONSTRAINT shop_transactions_transaction_type_check ON shop_transactions IS 'Types de transaction autorisés: purchase, purchase_pending, refund, gift'; 