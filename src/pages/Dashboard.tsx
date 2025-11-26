import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Ambulance, Building2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { MedicalStaffDashboard } from "@/components/MedicalStaffDashboard";
import { ReportCenterDashboard } from "@/components/ReportCenterDashboard";
import { toast } from "sonner";

interface DashboardStats {
  totalHospitals: number;
  availableBeds: number;
  totalAmbulances: number;
  availableAmbulances: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isMedicalStaff, setIsMedicalStaff] = useState(false);
  const [isReportCenter, setIsReportCenter] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalHospitals: 0,
    availableBeds: 0,
    totalAmbulances: 0,
    availableAmbulances: 0,
  });
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    fetchData();
    
    // Subscribe to real-time updates
    const hospitalsChannel = supabase
      .channel("hospitals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, () => {
        fetchData();
      })
      .subscribe();

    const ambulancesChannel = supabase
      .channel("ambulances-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(hospitalsChannel);
      supabase.removeChannel(ambulancesChannel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAuthChecked(true);
      navigate("/auth");
      return;
    }

    // Check user roles
    try {
      // Check for report_center role
      const { data: reportCenterRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "report_center")
        .maybeSingle();

      if (reportCenterRole) {
        setIsReportCenter(true);
        return;
      }

      // Check if user is medical staff
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization")
        .eq("id", session.user.id)
        .single();

      if (profile?.organization === "Medical Staff") {
        setIsMedicalStaff(true);
      }
    } catch (error) {
      console.error("Error checking user profile:", error);
    } finally {
      setAuthChecked(true);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch hospitals
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from("hospitals")
        .select("*")
        .order("name");

      if (hospitalsError) throw hospitalsError;

      // Fetch ambulances
      const { data: ambulancesData, error: ambulancesError } = await supabase
        .from("ambulances")
        .select("*")
        .order("vehicle_number");

      if (ambulancesError) throw ambulancesError;

      setHospitals(hospitalsData || []);
      setAmbulances(ambulancesData || []);

      // Calculate stats
      const totalBeds = (hospitalsData || []).reduce((sum, h) => sum + h.available_beds, 0);
      const availableAmbs = (ambulancesData || []).filter(a => a.status === "available").length;

      setStats({
        totalHospitals: hospitalsData?.length || 0,
        availableBeds: totalBeds,
        totalAmbulances: ambulancesData?.length || 0,
        availableAmbulances: availableAmbs,
      });
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {isMedicalStaff ? (
        <MedicalStaffDashboard />
      ) : isReportCenter ? (
        <ReportCenterDashboard />
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Welcome to PREMS</h1>
            <p className="text-muted-foreground">Your account is pending approval. Please contact an administrator.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
