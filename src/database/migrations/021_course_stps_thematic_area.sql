ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS stps_thematic_area_code VARCHAR(20)
    REFERENCES stps_thematic_areas(code);

CREATE INDEX IF NOT EXISTS idx_courses_stps_thematic_area
  ON courses (stps_thematic_area_code);
