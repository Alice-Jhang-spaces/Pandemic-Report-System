-- Allow report center to update hospital bed counts when assigning patients
CREATE POLICY "Report center can update hospital beds"
ON public.hospitals
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'report_center'::app_role))
WITH CHECK (has_role(auth.uid(), 'report_center'::app_role));