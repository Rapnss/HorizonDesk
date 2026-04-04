-- Users table — Pure OAuth-first (No passwords, no profile pics stored)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    rapnss_id TEXT UNIQUE,          -- Rapnss OAuth user ID (primary lookup key)
    email TEXT UNIQUE,              -- May be null if Rapnss doesn't expose it
    username TEXT,                  -- Display name
    handle TEXT,                    -- @handle / slug
    full_name TEXT,
    provider TEXT DEFAULT 'rapnss', -- Always 'rapnss'
    verified INTEGER DEFAULT 1,     -- OAuth users are always verified
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Developers Table (linked to users via Rapnss OAuth)
CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    agreed_to_terms INTEGER DEFAULT 0,
    free_releases_left INTEGER DEFAULT 1,
    ad_balance REAL DEFAULT 10.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Plugins Table
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    developer_id TEXT,
    name TEXT,
    description TEXT,
    full_description TEXT,           -- Detailed markdown description
    screenshots TEXT,                -- JSON array of URLs
    version TEXT,
    category TEXT DEFAULT 'general',
    icon_url TEXT,
    tigris_url TEXT,
    status TEXT DEFAULT 'pending_review',
    pricing_model TEXT DEFAULT 'free',  -- free, one_time, subscription
    usdc_wallet TEXT,                   -- Developer's Polygon USDC address
    gumroad_url TEXT,                   -- Gumroad product link
    price REAL DEFAULT 0.0,             -- Sale price in USD
    price_inr REAL DEFAULT 0.0,         -- Price in INR
    price_eur REAL DEFAULT 0.0,         -- Price in EUR
    price_cad REAL DEFAULT 0.0,         -- Price in CAD
    dynamic_pricing INTEGER DEFAULT 0,  -- 0 or 1
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ad Campaigns Table (RiskPay integrated)
CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    plugin_name TEXT,
    plan TEXT,
    provider TEXT,
    email TEXT,
    status TEXT DEFAULT 'pending',      -- pending, active, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
