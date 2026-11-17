ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(150),
  ADD COLUMN IF NOT EXISTS address_exterior_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address_interior_number VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_municipality VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_between_street_1 VARCHAR(150),
  ADD COLUMN IF NOT EXISTS address_between_street_2 VARCHAR(150);
