-- =============================================
-- MIRA ATTENDANCE - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY', 'STAFF', 'STUDENT');
CREATE TYPE app_status AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE app_type AS ENUM ('Leave', 'Bonafide', 'TC');
CREATE TYPE feedback_type AS ENUM ('Bug', 'Suggestion', 'Compliment');
CREATE TYPE feedback_status AS ENUM ('New', 'In Progress', 'Resolved');
CREATE TYPE attendance_status AS ENUM ('Present', 'Absent');
CREATE TYPE location_status AS ENUM ('On-Campus', 'Off-Campus');

-- =============================================
-- COLLEGES
-- =============================================
CREATE TABLE colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius INTEGER DEFAULT 500, -- meters
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  branch TEXT NOT NULL,
  year INTEGER,
  college_id UUID REFERENCES colleges(id) ON DELETE SET NULL,
  college_code TEXT,
  email TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  parent_email TEXT,
  parent_email_verified BOOLEAN DEFAULT FALSE,
  phone_number TEXT,
  image_url TEXT,
  reference_image_url TEXT,
  face_descriptor DOUBLE PRECISION[], -- face-api.js 128-float descriptor stored as array
  password TEXT NOT NULL DEFAULT 'mira@1234',
  father_name TEXT,
  aadhar_number TEXT,
  parent_phone_number TEXT,
  tenth_marks TEXT,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ATTENDANCE RECORDS
-- =============================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_pin TEXT NOT NULL,
  user_avatar TEXT,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'Present',
  timestamp TIME,
  location_status location_status,
  location_coordinates TEXT,
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX idx_attendance_user_date ON attendance_records(user_id, date);

-- =============================================
-- APPLICATIONS
-- =============================================
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type app_type NOT NULL,
  status app_status NOT NULL DEFAULT 'Pending',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_pin ON applications(pin);
CREATE INDEX idx_applications_status ON applications(status);

-- =============================================
-- SBTET RESULTS
-- =============================================
CREATE TABLE sbtet_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin TEXT NOT NULL,
  semester INTEGER NOT NULL,
  subjects JSONB NOT NULL DEFAULT '[]',
  total_marks INTEGER DEFAULT 0,
  credits_earned INTEGER DEFAULT 0,
  sgpa DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'Pass',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pin, semester)
);

-- =============================================
-- SYLLABUS COVERAGE
-- =============================================
CREATE TABLE syllabus_coverage (
  id TEXT PRIMARY KEY, -- e.g., ec-3-5-EC-501
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  faculty_id UUID REFERENCES users(id) ON DELETE SET NULL,
  faculty_name TEXT NOT NULL,
  total_topics INTEGER NOT NULL DEFAULT 0,
  topics_completed INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TIMETABLES
-- =============================================
CREATE TABLE timetables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  url TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  UNIQUE(branch, year)
);

-- =============================================
-- FEEDBACK
-- =============================================
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_role user_role NOT NULL,
  type feedback_type NOT NULL,
  message TEXT NOT NULL,
  status feedback_status NOT NULL DEFAULT 'New',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_anonymous BOOLEAN DEFAULT FALSE
);

-- =============================================
-- APP SETTINGS
-- =============================================
CREATE TABLE app_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications JSONB NOT NULL DEFAULT '{
    "email": {"attendance": true, "applications": true},
    "whatsapp": {"attendance": false}
  }',
  profile_private BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- OTP STORE (temporary, for login OTP)
-- =============================================
CREATE TABLE otp_store (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Using anon/service_role key approach — disable RLS for server-side access
-- Enable if using Supabase Auth per-user tokens

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbtet_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_store ENABLE ROW LEVEL SECURITY;

-- Allow full access via service_role (used from app with anon key in this setup)
-- For production: replace with proper user-based policies
CREATE POLICY "Allow all for anon" ON colleges FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON attendance_records FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON applications FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON sbtet_results FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON syllabus_coverage FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON timetables FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON feedback FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON app_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON otp_store FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE BUCKETS
-- =============================================
-- Run in Supabase Dashboard > Storage > Create bucket:
-- 1. "avatars"     (public: true)  — user profile photos
-- 2. "references"  (public: true)  — reference images for face recognition
-- 3. "timetables"  (public: true)  — timetable images
-- 4. "documents"   (public: false) — student documents (aadhar, marks, etc.)

-- =============================================
-- SEED: Default Super Admin
-- =============================================
-- Insert a default college first
INSERT INTO colleges (id, name, code, location, latitude, longitude, radius)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Government Polytechnic Sangareddy',
  '210',
  'Sangareddy, Telangana',
  17.6193,
  78.0833,
  500
);

-- Insert super admin (change password after setup!)
INSERT INTO users (pin, name, role, branch, college_code, password, email, email_verified)
VALUES (
  'bhanu99517',
  'BHANU ADMIN',
  'SUPER_ADMIN',
  'ADMIN',
  '210',
  'mira@admin2024',
  'bhanu99517@gmail.com',
  true
);
