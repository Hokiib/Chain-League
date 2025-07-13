-- Insert admin user
INSERT INTO players (
  username,
  wallet_address,
  email,
  chz_balance,
  subscription_status,
  subscription_expires_at,
  is_admin,
  created_at,
  updated_at
) VALUES (
  'admin',
  '0x1234567890123456789012345678901234567890',
  'admin@chainleague.com',
  10000.00,
  'premium',
  NOW() + INTERVAL '1 year',
  true,
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- Insert test user
INSERT INTO players (
  username,
  wallet_address,
  email,
  chz_balance,
  subscription_status,
  subscription_expires_at,
  is_admin,
  created_at,
  updated_at
) VALUES (
  'testuser',
  '0x9876543210987654321098765432109876543210',
  'test@chainleague.com',
  1000.00,
  'basic',
  NOW() + INTERVAL '1 month',
  false,
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING; 