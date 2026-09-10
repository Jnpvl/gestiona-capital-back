-- Catálogo STPS: ocupaciones (puesto / CNO) y áreas temáticas de cursos
CREATE TABLE IF NOT EXISTS stps_occupations (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  area_code VARCHAR(10) NOT NULL,
  area_name VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stps_occupations_name ON stps_occupations (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_stps_occupations_area ON stps_occupations (area_code);

CREATE TABLE IF NOT EXISTS stps_thematic_areas (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(500) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stps_thematic_areas_name ON stps_thematic_areas (LOWER(name));

-- Áreas temáticas principales (catálogo STPS DC-3)
INSERT INTO stps_thematic_areas (code, name) VALUES
  ('1000', 'Producción general'),
  ('1100', 'Producción agrícola y ganadera'),
  ('1200', 'Producción industrial'),
  ('2000', 'Servicios'),
  ('2100', 'Servicios turísticos'),
  ('2200', 'Servicios de alimentos y bebidas'),
  ('3000', 'Administración, contabilidad y economía'),
  ('3100', 'Administración y gestión'),
  ('3200', 'Contabilidad y finanzas'),
  ('4000', 'Comercialización'),
  ('4100', 'Ventas y mercadotecnia'),
  ('5000', 'Mantenimiento y reparación'),
  ('5100', 'Mantenimiento industrial'),
  ('6000', 'Seguridad'),
  ('6100', 'Seguridad e higiene en el trabajo'),
  ('6200', 'Protección civil y emergencias'),
  ('6300', 'Medio ambiente y sustentabilidad'),
  ('7000', 'Desarrollo personal y familiar'),
  ('8000', 'Uso de tecnologías de la información y comunicación'),
  ('8100', 'Informática y sistemas'),
  ('9000', 'Participación social')
ON CONFLICT (code) DO NOTHING;

-- Ocupaciones del Catálogo Nacional de Ocupaciones (muestra representativa)
INSERT INTO stps_occupations (code, name, area_code, area_name) VALUES
  ('01', 'Cultivo, crianza y aprovechamiento', '01', 'Cultivo, crianza y aprovechamiento'),
  ('01.1', 'Agricultura y silvicultura', '01', 'Cultivo, crianza y aprovechamiento'),
  ('01.2', 'Ganadería', '01', 'Cultivo, crianza y aprovechamiento'),
  ('02', 'Extracción y suministro', '02', 'Extracción y suministro'),
  ('02.2', 'Extracción', '02', 'Extracción y suministro'),
  ('03', 'Construcción', '03', 'Construcción'),
  ('03.1', 'Edificación', '03', 'Construcción'),
  ('03.2', 'Instalación y mantenimiento', '03', 'Construcción'),
  ('04', 'Tecnología', '04', 'Tecnología'),
  ('04.4', 'Informática', '04', 'Tecnología'),
  ('05', 'Procesamiento y fabricación', '05', 'Procesamiento y fabricación'),
  ('05.7', 'Productos metálicos y de hule y plástico', '05', 'Procesamiento y fabricación'),
  ('06', 'Transporte', '06', 'Transporte'),
  ('06.1', 'Ferroviario', '06', 'Transporte'),
  ('06.2', 'Aéreo', '06', 'Transporte'),
  ('06.3', 'Marítimo y fluvial', '06', 'Transporte'),
  ('06.4', 'Carretero', '06', 'Transporte'),
  ('07', 'Provisión de bienes y servicios', '07', 'Provisión de bienes y servicios'),
  ('07.1', 'Abastecimiento de bienes', '07', 'Provisión de bienes y servicios'),
  ('07.5', 'Servicios personales', '07', 'Provisión de bienes y servicios'),
  ('08', 'Gestión y soporte administrativo', '08', 'Gestión y soporte administrativo'),
  ('08.1', 'Bolsa, banca y seguros', '08', 'Gestión y soporte administrativo'),
  ('08.2', 'Administración', '08', 'Gestión y soporte administrativo'),
  ('08.3', 'Servicios de apoyo administrativo', '08', 'Gestión y soporte administrativo'),
  ('09', 'Salud y protección social', '09', 'Salud y protección social'),
  ('09.1', 'Atención sanitaria y servicios médicos', '09', 'Salud y protección social'),
  ('09.4', 'Protección de bienes y/o personas', '09', 'Salud y protección social'),
  ('10', 'Comunicación', '10', 'Comunicación'),
  ('10.1', 'Medios masivos', '10', 'Comunicación'),
  ('11', 'Desarrollo y extensión del conocimiento', '11', 'Desarrollo y extensión del conocimiento'),
  ('11.1', 'Investigación', '11', 'Desarrollo y extensión del conocimiento'),
  ('11.2', 'Enseñanza', '11', 'Desarrollo y extensión del conocimiento')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS rfc VARCHAR(13);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS curp VARCHAR(18),
  ADD COLUMN IF NOT EXISTS stps_occupation_code VARCHAR(20) REFERENCES stps_occupations(code),
  ADD COLUMN IF NOT EXISTS stps_thematic_area_code VARCHAR(20) REFERENCES stps_thematic_areas(code);

CREATE INDEX IF NOT EXISTS idx_students_curp ON students (curp);
CREATE INDEX IF NOT EXISTS idx_students_stps_occupation ON students (stps_occupation_code);
CREATE INDEX IF NOT EXISTS idx_students_stps_thematic_area ON students (stps_thematic_area_code);
