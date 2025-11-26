-- Add hospital_id column to ambulances table to track which hospital an ambulance is assigned to
ALTER TABLE public.ambulances 
ADD COLUMN hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_ambulances_hospital_id ON public.ambulances(hospital_id);