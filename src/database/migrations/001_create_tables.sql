-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(30) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL,
    logo_url TEXT,
    total_score INTEGER DEFAULT 0,
    total_cells_controlled INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    username VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    team_id UUID REFERENCES teams(id),
    subscription_status VARCHAR(20) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    total_score INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_cells_captured INTEGER DEFAULT 0,
    chz_balance DECIMAL(18,8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create game_sessions table
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    betting_start_date TIMESTAMP WITH TIME ZONE,
    betting_end_date TIMESTAMP WITH TIME ZONE,
    winner_team_id UUID REFERENCES teams(id),
    total_participants INTEGER DEFAULT 0,
    total_bets DECIMAL(18,8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create map_cells table
CREATE TABLE map_cells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    x_coordinate INTEGER NOT NULL,
    y_coordinate INTEGER NOT NULL,
    team_id UUID REFERENCES teams(id),
    current_hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    last_clicked_at TIMESTAMP WITH TIME ZONE,
    last_clicked_by UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, x_coordinate, y_coordinate)
);

-- Create player_clicks table
CREATE TABLE player_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    session_id UUID NOT NULL REFERENCES game_sessions(id),
    cell_id UUID NOT NULL REFERENCES map_cells(id),
    x_coordinate INTEGER NOT NULL,
    y_coordinate INTEGER NOT NULL,
    damage_dealt INTEGER NOT NULL,
    team_id UUID REFERENCES teams(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bets table
CREATE TABLE bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    session_id UUID NOT NULL REFERENCES game_sessions(id),
    team_id UUID NOT NULL REFERENCES teams(id),
    amount DECIMAL(18,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    payout_amount DECIMAL(18,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    plan_type VARCHAR(20) NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_events table
CREATE TABLE daily_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES game_sessions(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create player_boosts table
CREATE TABLE player_boosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id),
    boost_type VARCHAR(50) NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_players_wallet_address ON players(wallet_address);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_map_cells_session_coordinates ON map_cells(session_id, x_coordinate, y_coordinate);
CREATE INDEX idx_map_cells_team_id ON map_cells(team_id);
CREATE INDEX idx_player_clicks_player_session ON player_clicks(player_id, session_id);
CREATE INDEX idx_player_clicks_created_at ON player_clicks(created_at);
CREATE INDEX idx_bets_player_session ON bets(player_id, session_id);
CREATE INDEX idx_bets_team_id ON bets(team_id);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_dates ON game_sessions(start_date, end_date);
CREATE INDEX idx_subscriptions_player_status ON subscriptions(player_id, status);
CREATE INDEX idx_daily_events_session_active ON daily_events(session_id, is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_map_cells_updated_at BEFORE UPDATE ON map_cells FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bets_updated_at BEFORE UPDATE ON bets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 