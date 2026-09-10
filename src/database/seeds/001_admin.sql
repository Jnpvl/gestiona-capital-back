-- Requiere que existan las tablas (ejecuta init.sql o npm run db:migrate primero).
-- Email: admin@gestionach.com | Password: admin123

INSERT INTO staff (name, email, password_hash, role)
VALUES (
  'Administrador',
  'admin@gestionach.com',
  '$2b$12$KFpFBck8ZiOzy/r757lPfue3Q49vWZH9mdAMLeM94alZ3QtViCZgK',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
