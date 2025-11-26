-- First, fix existing invalid severity values
UPDATE public.emergency_reports 
SET severity = 'low' 
WHERE severity NOT IN ('critical', 'high', 'medium', 'low');

-- Fix 1: Remove self-service role assignment vulnerability
DROP POLICY IF EXISTS "Users can insert their own roles" ON public.user_roles;

-- Replace with admin-only role assignment
CREATE POLICY "Only CDC admins can assign roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'cdc_admin'::app_role));

-- Fix 2: Add database constraint to prevent negative hospital beds (race condition)
ALTER TABLE public.hospitals 
ADD CONSTRAINT available_beds_non_negative 
CHECK (available_beds >= 0);

ALTER TABLE public.hospitals 
ADD CONSTRAINT available_icu_beds_non_negative 
CHECK (available_icu_beds >= 0);

-- Fix 3: Add validation constraints on emergency_reports
ALTER TABLE public.emergency_reports
ADD CONSTRAINT patient_age_valid 
CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 150));

ALTER TABLE public.emergency_reports
ADD CONSTRAINT patient_name_valid 
CHECK (length(trim(patient_name)) > 0 AND length(patient_name) <= 100);

ALTER TABLE public.emergency_reports
ADD CONSTRAINT symptoms_valid 
CHECK (length(trim(symptoms)) > 0 AND length(symptoms) <= 2000);

ALTER TABLE public.emergency_reports
ADD CONSTRAINT patient_address_valid 
CHECK (patient_address IS NULL OR (length(trim(patient_address)) > 0 AND length(patient_address) <= 500));

ALTER TABLE public.emergency_reports
ADD CONSTRAINT pickup_location_valid 
CHECK (length(trim(pickup_location)) > 0 AND length(pickup_location) <= 500);

ALTER TABLE public.emergency_reports
ADD CONSTRAINT severity_valid 
CHECK (severity IN ('critical', 'high', 'medium', 'low'));