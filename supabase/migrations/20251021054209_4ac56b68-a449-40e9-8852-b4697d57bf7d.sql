-- Update hospitals RLS policies to require authentication
DROP POLICY IF EXISTS "Anyone authenticated can view hospitals" ON public.hospitals;
CREATE POLICY "Authenticated users can view hospitals"
  ON public.hospitals
  FOR SELECT
  TO authenticated
  USING (true);

-- Update ambulances RLS policies to require authentication
DROP POLICY IF EXISTS "Anyone authenticated can view ambulances" ON public.ambulances;
CREATE POLICY "Authenticated users can view ambulances"
  ON public.ambulances
  FOR SELECT
  TO authenticated
  USING (true);

-- Report center can assign ambulances
CREATE POLICY "Report center can assign ambulances"
  ON public.ambulances
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'report_center'::app_role) OR has_role(auth.uid(), 'cdc_admin'::app_role));

-- Report center can update emergency reports
CREATE POLICY "Report center can update emergency reports"
  ON public.emergency_reports
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'report_center'::app_role) OR has_role(auth.uid(), 'cdc_admin'::app_role));

-- Report center can view all emergency reports
CREATE POLICY "Report center can view all reports"
  ON public.emergency_reports
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'report_center'::app_role) OR has_role(auth.uid(), 'cdc_admin'::app_role) OR auth.uid() = reported_by);