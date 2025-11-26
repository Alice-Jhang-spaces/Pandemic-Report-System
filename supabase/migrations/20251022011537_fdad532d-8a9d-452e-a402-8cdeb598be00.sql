-- Update policy to ensure report center can see ALL reports including anonymous ones
DROP POLICY IF EXISTS "Report center can view all reports" ON emergency_reports;

CREATE POLICY "Report center can view all reports"
ON emergency_reports
FOR SELECT
USING (
  has_role(auth.uid(), 'report_center'::app_role) 
  OR has_role(auth.uid(), 'cdc_admin'::app_role) 
  OR (reported_by IS NOT NULL AND auth.uid() = reported_by)
);

-- Also ensure public can create reports via chat (anonymous)
CREATE POLICY "Public can create emergency reports"
ON emergency_reports
FOR INSERT
TO anon
WITH CHECK (true);