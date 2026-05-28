-- ============================================================
-- AUDIOBAAZ — DEV SEED DATA
-- Run after schema.sql in development only
-- ============================================================

-- Admin user (insert after creating a Supabase auth user with this phone)
-- INSERT INTO users (id, phone, full_name, role)
-- VALUES ('your-supabase-auth-uuid', '+919999999999', 'Admin', 'admin');

-- Sample products
INSERT INTO products (name, brand, model, category, retail_price, is_verified) VALUES
  ('Moondrop Aria Snow', 'Moondrop', 'Aria Snow', 'iem', 350000, true),
  ('Sennheiser HD 600', 'Sennheiser', 'HD 600', 'headphone', 5999900, true),
  ('FiiO BTR7', 'FiiO', 'BTR7', 'dac_amp', 1699900, true),
  ('Topping DX3 Pro+', 'Topping', 'DX3 Pro+', 'dac_amp', 1699900, true),
  ('Linsoul TIN HiFi T3 Plus', 'TIN HiFi', 'T3 Plus', 'iem', 449900, true);
