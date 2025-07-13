-- Insert initial teams
INSERT INTO teams (name, color, logo_url) VALUES
('Red Dragons', '#FF4444', 'https://example.com/red-dragons.png'),
('Blue Phoenix', '#4444FF', 'https://example.com/blue-phoenix.png'),
('Green Warriors', '#44FF44', 'https://example.com/green-warriors.png'),
('Yellow Lightning', '#FFFF44', 'https://example.com/yellow-lightning.png'),
('Purple Storm', '#FF44FF', 'https://example.com/purple-storm.png'),
('Orange Crushers', '#FF8844', 'https://example.com/orange-crushers.png'),
('Cyan Thunder', '#44FFFF', 'https://example.com/cyan-thunder.png'),
('Pink Panthers', '#FF44AA', 'https://example.com/pink-panthers.png')
ON CONFLICT (name) DO NOTHING;

-- Insert sample daily events (for testing)
INSERT INTO daily_events (session_id, event_type, event_data, start_time, end_time, is_active) 
SELECT 
  gs.id,
  'double_click_damage',
  '{"multiplier": 2, "description": "Double damage event - all clicks deal 2x damage!"}',
  NOW(),
  NOW() + INTERVAL '24 hours',
  true
FROM game_sessions gs 
WHERE gs.status = 'active' 
LIMIT 1
ON CONFLICT DO NOTHING; 