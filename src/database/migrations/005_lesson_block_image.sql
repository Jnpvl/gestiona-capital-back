-- Bloque de imagen dentro de una clase
DO $$ BEGIN
  ALTER TYPE lesson_block_type ADD VALUE 'image';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
