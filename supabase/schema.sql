-- ============================================================
-- AUDIOBAAZ V1 — SUPABASE SCHEMA
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             TEXT UNIQUE NOT NULL,
  email             TEXT UNIQUE,
  full_name         TEXT,
  city              TEXT,
  pincode           TEXT,
  upi_id            TEXT,
  telegram_chat_id  TEXT,
  telegram_alerts   JSONB DEFAULT '{
    "listing_approved": true,
    "offer_received": true,
    "offer_accepted": true,
    "order_update": true,
    "price_drop": true,
    "saved_search_match": true,
    "payout_sent": true,
    "dispute_update": true
  }',
  role              TEXT DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  seller_score      INTEGER DEFAULT 100,
  buyer_score       INTEGER DEFAULT 100,
  is_active         BOOLEAN DEFAULT true,
  availability      TEXT DEFAULT 'active'
    CHECK (availability IN ('active', 'away', 'paused')),
  availability_until DATE,
  strike_count      INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT DATABASE
-- ============================================================

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  category      TEXT NOT NULL
    CHECK (category IN (
      'iem', 'headphone', 'dac', 'amp', 'dac_amp',
      'cable', 'source', 'accessory', 'other'
    )),
  subcategory   TEXT,
  retail_price  INTEGER,
  year_released INTEGER,
  description   TEXT,
  specs         JSONB,
  image_url     TEXT,
  is_verified   BOOLEAN DEFAULT false,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX products_name_trgm  ON products USING GIN (name  gin_trgm_ops);
CREATE INDEX products_brand_trgm ON products USING GIN (brand gin_trgm_ops);

-- ============================================================
-- LISTINGS
-- ============================================================

CREATE TABLE listings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id             UUID NOT NULL REFERENCES users(id),
  product_id            UUID REFERENCES products(id),
  -- Product info (from DB or manual entry)
  product_name          TEXT NOT NULL,
  brand                 TEXT NOT NULL,
  category              TEXT NOT NULL
    CHECK (category IN (
      'iem', 'headphone', 'dac', 'amp', 'dac_amp',
      'cable', 'source', 'accessory', 'other'
    )),
  -- Condition
  condition_grade       TEXT NOT NULL
    CHECK (condition_grade IN ('S', 'A', 'B', 'C', 'D')),
  condition_notes       TEXT,
  known_defects         TEXT,
  -- Inclusions
  inclusions            JSONB NOT NULL,
  -- Photos
  photos                TEXT[] NOT NULL,
  photo_count           INTEGER GENERATED ALWAYS AS (array_length(photos, 1)) STORED,
  -- Pricing
  asking_price          INTEGER NOT NULL,
  platform_fee_pct      DECIMAL DEFAULT 10.0,
  seller_payout         INTEGER GENERATED ALWAYS AS (FLOOR(asking_price * 0.9)) STORED,
  -- Negotiation
  is_negotiable         BOOLEAN DEFAULT false,
  floor_price           INTEGER,
  auto_accept_threshold INTEGER,
  -- Ownership proof
  ownership_proof_type  TEXT
    CHECK (ownership_proof_type IN ('invoice', 'email', 'screenshot', 'none')),
  ownership_proof_url   TEXT,
  -- Status
  status                TEXT DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending', 'approved', 'reserved', 'sold',
      'completed', 'rejected', 'delisted', 'archived'
    )),
  rejection_reason      TEXT,
  rejection_fields      TEXT[],
  -- Sharing
  slug                  TEXT UNIQUE,
  share_url             TEXT GENERATED ALWAYS AS
    ('https://audiobaaz.com/listing/' || slug) STORED,
  -- Analytics
  view_count            INTEGER DEFAULT 0,
  watchlist_count       INTEGER DEFAULT 0,
  -- Timestamps
  submitted_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  reserved_at           TIMESTAMPTZ,
  reserved_until        TIMESTAMPTZ,
  sold_at               TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX listings_seller_id          ON listings(seller_id);
CREATE INDEX listings_status             ON listings(status);
CREATE INDEX listings_category           ON listings(category);
CREATE INDEX listings_asking_price       ON listings(asking_price);
CREATE INDEX listings_slug               ON listings(slug);
CREATE INDEX listings_product_name_trgm  ON listings USING GIN (product_name gin_trgm_ops);

-- ============================================================
-- PRICE HISTORY
-- ============================================================

CREATE TABLE price_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID REFERENCES products(id),
  product_name    TEXT NOT NULL,
  category        TEXT NOT NULL,
  condition_grade TEXT NOT NULL,
  sold_price      INTEGER NOT NULL,
  listing_id      UUID REFERENCES listings(id),
  sold_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX price_history_product_id   ON price_history(product_id);
CREATE INDEX price_history_product_name ON price_history(product_name);

-- ============================================================
-- OFFERS
-- ============================================================

CREATE TABLE offers (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id             UUID NOT NULL REFERENCES listings(id),
  buyer_id               UUID NOT NULL REFERENCES users(id),
  seller_id              UUID NOT NULL REFERENCES users(id),
  offered_price          INTEGER NOT NULL,
  status                 TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'accepted', 'declined', 'expired', 'paid', 'cancelled'
    )),
  seller_must_respond_by TIMESTAMPTZ,
  buyer_must_pay_by      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX offers_listing_id ON offers(listing_id);
CREATE INDEX offers_buyer_id   ON offers(buyer_id);
CREATE INDEX offers_seller_id  ON offers(seller_id);
CREATE INDEX offers_status     ON offers(status);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id             UUID NOT NULL REFERENCES listings(id),
  buyer_id               UUID NOT NULL REFERENCES users(id),
  seller_id              UUID NOT NULL REFERENCES users(id),
  offer_id               UUID REFERENCES offers(id),
  -- Pricing snapshot
  listing_price          INTEGER NOT NULL,
  paid_price             INTEGER NOT NULL,
  platform_fee           INTEGER NOT NULL,
  shipping_fee           INTEGER NOT NULL,
  seller_payout          INTEGER NOT NULL,
  -- Delivery address snapshot
  delivery_name          TEXT NOT NULL,
  delivery_phone         TEXT NOT NULL,
  delivery_line1         TEXT NOT NULL,
  delivery_line2         TEXT,
  delivery_city          TEXT NOT NULL,
  delivery_pincode       TEXT NOT NULL,
  delivery_state         TEXT NOT NULL,
  -- Status
  status                 TEXT DEFAULT 'payment_pending'
    CHECK (status IN (
      'payment_pending', 'payment_failed', 'escrow_held',
      'seller_confirmed', 'shipped', 'delivered', 'inspection',
      'completed', 'disputed', 'refunded', 'partially_refunded'
    )),
  -- Shipping
  shiprocket_order_id    TEXT,
  shiprocket_shipment_id TEXT,
  tracking_number        TEXT,
  courier_name           TEXT,
  estimated_delivery     DATE,
  -- Timing
  escrow_held_at         TIMESTAMPTZ,
  shipped_at             TIMESTAMPTZ,
  delivered_at           TIMESTAMPTZ,
  inspection_expires_at  TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  seller_must_ship_by    TIMESTAMPTZ,
  -- Payout
  payout_status          TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_reference       TEXT,
  payout_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX orders_buyer_id   ON orders(buyer_id);
CREATE INDEX orders_seller_id  ON orders(seller_id);
CREATE INDEX orders_listing_id ON orders(listing_id);
CREATE INDEX orders_status     ON orders(status);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  razorpay_order_id   TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  amount              INTEGER NOT NULL,
  currency            TEXT DEFAULT 'INR',
  status              TEXT DEFAULT 'created'
    CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
  method              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISPUTES
-- ============================================================

CREATE TABLE disputes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  buyer_id      UUID NOT NULL REFERENCES users(id),
  seller_id     UUID NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL
    CHECK (reason IN (
      'condition_mismatch', 'non_functional', 'missing_accessory',
      'not_received', 'wrong_item'
    )),
  description   TEXT NOT NULL,
  evidence_urls TEXT[],
  status        TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  resolution    TEXT
    CHECK (resolution IN ('full_refund', 'partial_refund', 'rejected', 'replacement')),
  refund_amount INTEGER,
  admin_notes   TEXT,
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RATINGS
-- ============================================================

CREATE TABLE ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) UNIQUE,
  buyer_id   UUID NOT NULL REFERENCES users(id),
  seller_id  UUID NOT NULL REFERENCES users(id),
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE VIEW seller_ratings AS
  SELECT
    seller_id,
    COUNT(*) AS total_ratings,
    ROUND(AVG(stars), 1) AS average_rating,
    COUNT(*) FILTER (WHERE stars = 5) AS five_star,
    COUNT(*) FILTER (WHERE stars = 4) AS four_star,
    COUNT(*) FILTER (WHERE stars = 3) AS three_star,
    COUNT(*) FILTER (WHERE stars <= 2) AS low_star
  FROM ratings
  GROUP BY seller_id;

-- ============================================================
-- WATCHLIST
-- ============================================================

CREATE TABLE watchlist (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id),
  listing_id     UUID NOT NULL REFERENCES listings(id),
  price_at_save  INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- ============================================================
-- SAVED SEARCHES
-- ============================================================

CREATE TABLE saved_searches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  label             TEXT,
  filters           JSONB NOT NULL,
  alerts_enabled    BOOLEAN DEFAULT true,
  alert_count_today INTEGER DEFAULT 0,
  last_alert_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL,
  message      TEXT NOT NULL,
  sent_via     TEXT DEFAULT 'telegram',
  status       TEXT DEFAULT 'sent',
  reference_id UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADMIN REVIEW LOG
-- ============================================================

CREATE TABLE listing_reviews (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID NOT NULL REFERENCES listings(id),
  reviewed_by  UUID NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL
    CHECK (action IN ('approved', 'rejected', 'flagged')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "users_read_own"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Listings: anyone reads approved, seller reads all their own
CREATE POLICY "listings_read_approved" ON listings
  FOR SELECT USING (status = 'approved');
CREATE POLICY "listings_read_own" ON listings
  FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "listings_insert_own" ON listings
  FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "listings_update_own" ON listings
  FOR UPDATE USING (auth.uid() = seller_id);

-- Offers: buyer and seller read their own
CREATE POLICY "offers_read_parties" ON offers
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Orders: buyer and seller read their own
CREATE POLICY "orders_read_parties" ON orders
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Watchlist and saved searches: user owns their own
CREATE POLICY "watchlist_own"      ON watchlist      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "saved_searches_own" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER offers_updated_at   BEFORE UPDATE ON offers   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Set inspection window when order marked delivered
CREATE OR REPLACE FUNCTION set_inspection_window()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at          = NOW();
    NEW.inspection_expires_at = NOW() + INTERVAL '48 hours';
    NEW.status                = 'inspection';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_inspection_window
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_inspection_window();

-- Record price history when order completes
CREATE OR REPLACE FUNCTION record_price_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO price_history (
      product_id, product_name, category,
      condition_grade, sold_price, listing_id
    )
    SELECT
      l.product_id, l.product_name, l.category,
      l.condition_grade, o.paid_price, o.listing_id
    FROM orders o
    JOIN listings l ON l.id = o.listing_id
    WHERE o.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_price_history
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION record_price_history();

-- Reserve listing when checkout starts
CREATE OR REPLACE FUNCTION reserve_listing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'payment_pending' THEN
    UPDATE listings
    SET
      status         = 'reserved',
      reserved_at    = NOW(),
      reserved_until = NOW() + INTERVAL '15 minutes'
    WHERE id = NEW.listing_id
      AND status = 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_reserve_listing
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION reserve_listing();
