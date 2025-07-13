const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testShop() {
  try {
    console.log('🧪 Test de la boutique...\n');
    
    // 1. Tester l'endpoint des items
    console.log('1. Test des items de la boutique:');
    const itemsResponse = await axios.get(`${API_BASE}/shop/items`);
    console.log(`   ✅ ${itemsResponse.data.boosts.length} boosts trouvés`);
    console.log(`   ✅ ${itemsResponse.data.cosmetics.length} cosmétiques trouvés`);
    console.log(`   ✅ ${itemsResponse.data.subscriptions.length} abonnements trouvés`);
    
    // 2. Créer un utilisateur de test
    console.log('\n2. Création d\'un utilisateur de test:');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      walletAddress: '0xtest789',
      username: 'boutique-test',
      signature: '0x789',
      message: 'test',
      teamId: 'psg'
    });
    const token = registerResponse.data.token;
    console.log(`   ✅ Utilisateur créé, token: ${token.substring(0, 20)}...`);
    
    // 3. Tester l'inventaire
    console.log('\n3. Test de l\'inventaire:');
    const inventoryResponse = await axios.get(`${API_BASE}/shop/inventory`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ ${inventoryResponse.data.boosts.length} boosts en inventaire`);
    console.log(`   ✅ ${inventoryResponse.data.cosmetics.length} cosmétiques en inventaire`);
    console.log(`   ✅ ${inventoryResponse.data.subscriptions.length} abonnements en inventaire`);
    
    // 4. Tester un achat
    console.log('\n4. Test d\'achat:');
    const purchaseResponse = await axios.post(`${API_BASE}/shop/buy`, {
      itemId: 1
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Achat réussi: ${purchaseResponse.data.item.name}`);
    console.log(`   ✅ Nouveau solde: ${purchaseResponse.data.newBalance} CHZ`);
    
    // 5. Tester l'activation de boost
    console.log('\n5. Test d\'activation de boost:');
    const activateResponse = await axios.post(`${API_BASE}/shop/activate-boost`, {
      itemId: '1'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   ✅ Boost activé: ${activateResponse.data.boost.name}`);
    
    console.log('\n🎉 Tous les tests ont réussi ! La boutique fonctionne correctement.');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.response?.data || error.message);
  }
}

testShop(); 