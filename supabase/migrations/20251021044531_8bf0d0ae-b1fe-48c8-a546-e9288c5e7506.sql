-- Add hospital_id to profiles table to link medical staff to hospitals
ALTER TABLE public.profiles 
ADD COLUMN hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_profiles_hospital_id ON public.profiles(hospital_id);

-- Update RLS policy for hospitals - allow medical staff to update their own hospital
DROP POLICY IF EXISTS "Hospital staff can update their hospital" ON public.hospitals;

CREATE POLICY "Hospital staff can update their hospital" 
ON public.hospitals 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.hospital_id = hospitals.id
  ) OR has_role(auth.uid(), 'cdc_admin'::app_role)
);

-- Allow medical staff to view their own hospital data
CREATE POLICY "Medical staff can view their hospital" 
ON public.hospitals 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.hospital_id = hospitals.id
  ) OR true
);