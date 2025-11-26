-- First, fix existing invalid severity values
UPDATE public.emergency_reports 
SET severity = 'low' 
WHERE severity NOT IN ('critical', 'high', 'medium', 'low');

-- Fix 2: Add database constraint to prevent negative hospital beds (race condition)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'available_beds_non_negative'
  ) THEN
    ALTER TABLE public.hospitals 
    ADD CONSTRAINT available_beds_non_negative 
    CHECK (available_beds >= 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'available_icu_beds_non_negative'
  ) THEN
    ALTER TABLE public.hospitals 
    ADD CONSTRAINT available_icu_beds_non_negative 
    CHECK (available_icu_beds >= 0);
  END IF;
END $$;

-- Fix 3: Add validation constraints on emergency_reports
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_age_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT patient_age_valid 
    CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 150));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_name_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT patient_name_valid 
    CHECK (length(trim(patient_name)) > 0 AND length(patient_name) <= 100);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'symptoms_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT symptoms_valid 
    CHECK (length(trim(symptoms)) > 0 AND length(symptoms) <= 2000);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_address_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT patient_address_valid 
    CHECK (patient_address IS NULL OR (length(trim(patient_address)) > 0 AND length(patient_address) <= 500));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pickup_location_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT pickup_location_valid 
    CHECK (length(trim(pickup_location)) > 0 AND length(pickup_location) <= 500);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'severity_valid'
  ) THEN
    ALTER TABLE public.emergency_reports
    ADD CONSTRAINT severity_valid 
    CHECK (severity IN ('critical', 'high', 'medium', 'low'));
  END IF;
END $$;