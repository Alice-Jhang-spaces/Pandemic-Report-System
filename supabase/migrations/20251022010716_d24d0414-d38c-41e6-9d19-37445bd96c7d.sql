-- Allow report center users to insert ambulances
DROP POLICY IF EXISTS "CDC admins can insert ambulances" ON ambulances;

CREATE POLICY "CDC admins and report center can insert ambulances"
ON ambulances
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'cdc_admin'::app_role) OR has_role(auth.uid(), 'report_center'::app_role));