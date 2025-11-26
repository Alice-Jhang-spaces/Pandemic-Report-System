-- Add maintenance status to ambulance_status enum
ALTER TYPE public.ambulance_status ADD VALUE IF NOT EXISTS 'maintenance';

-- Add phone and address fields to emergency_reports
ALTER TABLE public.emergency_reports
ADD COLUMN IF NOT EXISTS patient_phone text,
ADD COLUMN IF NOT EXISTS patient_address text;