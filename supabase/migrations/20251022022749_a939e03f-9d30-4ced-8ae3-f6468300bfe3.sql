-- Allow hospital staff to manage ambulances assigned to their hospital
CREATE POLICY "Hospital staff can release assigned ambulances"
ON public.ambulances
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = auth.uid() AND p.hospital_id = hospital_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = auth.uid() AND p.hospital_id = hospital_id
));

-- Allow medical staff to view reports for their hospital
CREATE POLICY "Medical staff can view hospital reports"
ON public.emergency_reports
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.hospital_id = hospital_id
));

-- Allow medical staff to update reports for their hospital (e.g., mark completed)
CREATE POLICY "Medical staff can update hospital reports"
ON public.emergency_reports
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = auth.uid() AND p.hospital_id = hospital_id
));