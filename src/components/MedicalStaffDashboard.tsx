import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Ambulance, BedDouble, Activity } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";

interface Hospital {
  id: string;
  name: string;
  address: string;
  total_beds: number;
  available_beds: number;
  icu_beds: number;
  available_icu_beds: number;
  latitude: number | null;
  longitude: number | null;
}

interface Ambulance {
  id: string;
  vehicle_number: string;
  status: string;
  current_location: string | null;
  emergency_report_id?: string | null;
  patient_name?: string | null;
}

interface IncomingAmbulance {
  vehicle_number: string;
  patient_name: string;
  ambulance_id: string;
}

export const MedicalStaffDashboard = () => {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [incomingAmbulances, setIncomingAmbulances] = useState<IncomingAmbulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [bedData, setBedData] = useState({
    available_beds: 0,
    available_icu_beds: 0,
  });

  useEffect(() => {
    fetchHospitalData();
    
    // Subscribe to real-time updates
    const hospitalsChannel = supabase
      .channel("hospitals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, () => {
        fetchHospitalData();
      })
      .subscribe();

    const emergencyReportsChannel = supabase
      .channel("emergency-reports-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_reports" }, () => {
        fetchHospitalData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(hospitalsChannel);
      supabase.removeChannel(emergencyReportsChannel);
    };
  }, []);

  const fetchHospitalData = async () => {
    try {
      // Get user profile to find their hospital
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("hospital_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile?.hospital_id) {
        toast.error("No hospital assigned to your account. Please contact admin.");
        setLoading(false);
        return;
      }

      // Fetch hospital details
      const { data: hospitalData, error: hospitalError } = await supabase
        .from("hospitals")
        .select("*")
        .eq("id", profile.hospital_id)
        .single();

      if (hospitalError) throw hospitalError;

      setHospital(hospitalData);
      setBedData({
        available_beds: hospitalData.available_beds,
        available_icu_beds: hospitalData.available_icu_beds,
      });

      // Fetch ambulances assigned to emergency reports at this hospital
      const { data: emergenciesData } = await supabase
        .from("emergency_reports")
        .select("id, patient_name, ambulance_id, status")
        .eq("hospital_id", profile.hospital_id)
        .in("status", ["en_route", "completed"]);

      // Create a map of ambulance_id to emergency details
      const ambulanceMap = new Map(
        emergenciesData?.map(e => [e.ambulance_id, { emergency_id: e.id, patient_name: e.patient_name, status: e.status }]) || []
      );

      // Fetch ambulances assigned to this hospital
      const { data: ambulancesData, error: ambulancesError } = await supabase
        .from("ambulances")
        .select("*")
        .eq("hospital_id", profile.hospital_id)
        .order("vehicle_number");

      if (ambulancesError) throw ambulancesError;

      // Add emergency report info to ambulances
      const enrichedAmbulances = (ambulancesData || []).map(amb => {
        const emergencyInfo = ambulanceMap.get(amb.id);
        return {
          ...amb,
          emergency_report_id: emergencyInfo?.emergency_id || null,
          patient_name: emergencyInfo?.patient_name || null,
        };
      });

      setAmbulances(enrichedAmbulances);
      
      // Get incoming ambulances details
      const incoming = emergenciesData
        ?.filter(e => e.status === "en_route" && e.ambulance_id)
        .map(e => {
          const amb = ambulancesData?.find(a => a.id === e.ambulance_id);
          return {
            vehicle_number: amb?.vehicle_number || "Unknown",
            patient_name: e.patient_name,
            ambulance_id: e.ambulance_id,
          };
        }) || [];
      
      setIncomingAmbulances(incoming);
    } catch (error: any) {
      toast.error("Failed to load hospital data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("hospitals")
        .update({
          available_beds: bedData.available_beds,
          available_icu_beds: bedData.available_icu_beds,
        })
        .eq("id", hospital.id);

      if (error) throw error;

      toast.success("Bed availability updated successfully");
      await fetchHospitalData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update bed availability");
    } finally {
      setUpdating(false);
    }
  };

  const handleReleaseAmbulance = async (ambulanceId: string, emergencyReportId: string | null) => {
    if (!hospital) {
      toast.error("Hospital information not available");
      return;
    }

    // Show loading state
    const releaseToast = toast.loading("Releasing ambulance...");

    try {
      console.log("Starting ambulance release:", { ambulanceId, emergencyReportId, hospitalId: hospital.id });

      // Step 1: Update ambulance status to available and clear hospital assignment
      const { data: ambulanceData, error: ambulanceError } = await supabase
        .from("ambulances")
        .update({ 
          status: "available",
          busy_until: null,
          hospital_id: null
        })
        .eq("id", ambulanceId)
        .select()
        .single();

      if (ambulanceError) {
        console.error("Ambulance update error:", ambulanceError);
        throw new Error(`Failed to update ambulance: ${ambulanceError.message}`);
      }

      console.log("Ambulance updated successfully:", ambulanceData);

      // Step 2: Update emergency report status to completed if exists
      if (emergencyReportId) {
        const { data: reportData, error: reportError } = await supabase
          .from("emergency_reports")
          .update({ status: "completed" })
          .eq("id", emergencyReportId)
          .select()
          .single();

        if (reportError) {
          console.error("Emergency report update error:", reportError);
          throw new Error(`Failed to update emergency report: ${reportError.message}`);
        }

        console.log("Emergency report updated successfully:", reportData);
      }

      // Step 3: Increment available beds by 1
      const newBedCount = hospital.available_beds + 1;
      const { data: hospitalData, error: bedError } = await supabase
        .from("hospitals")
        .update({ available_beds: newBedCount })
        .eq("id", hospital.id)
        .select()
        .single();

      if (bedError) {
        console.error("Hospital beds update error:", bedError);
        throw new Error(`Failed to update hospital beds: ${bedError.message}`);
      }

      console.log("Hospital beds updated successfully:", hospitalData);

      toast.dismiss(releaseToast);
      toast.success("Ambulance released and bed freed successfully!");
      
      // Refresh dashboard data
      await fetchHospitalData();
    } catch (error: any) {
      console.error("Release ambulance error:", error);
      toast.dismiss(releaseToast);
      toast.error(error.message || "Failed to release ambulance. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Loading hospital data...</p>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Hospital Assigned</CardTitle>
            <CardDescription>
              Your account is not linked to a hospital. Please contact your administrator to assign a hospital to your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Medical Staff Dashboard</h1>
        <p className="text-muted-foreground">Manage your hospital's resources</p>
      </div>

      {/* Hospital Info Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>{hospital.name}</CardTitle>
          </div>
          <CardDescription>{hospital.address}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Location Coordinates</p>
              <p className="font-medium">
                {hospital.latitude && hospital.longitude
                  ? `${hospital.latitude}, ${hospital.longitude}`
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Capacity</p>
              <p className="font-medium">
                {hospital.total_beds} beds ({hospital.icu_beds} ICU)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bed Status & Incoming Ambulances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Regular Beds</CardTitle>
              </div>
              <Badge variant={hospital.available_beds > 0 ? "default" : "destructive"}>
                {hospital.available_beds > 0 ? "Available" : "Full"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hospital.available_beds}</div>
            <p className="text-sm text-muted-foreground">of {hospital.total_beds} beds available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">ICU Beds</CardTitle>
              </div>
              <Badge variant={hospital.available_icu_beds > 0 ? "default" : "destructive"}>
                {hospital.available_icu_beds > 0 ? "Available" : "Full"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hospital.available_icu_beds}</div>
            <p className="text-sm text-muted-foreground">of {hospital.icu_beds} ICU beds available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ambulance className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Incoming</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{incomingAmbulances.length}</div>
            <p className="text-sm text-muted-foreground mb-3">
              {incomingAmbulances.length === 1 ? "ambulance" : "ambulances"} en route
            </p>
            {incomingAmbulances.length > 0 && (
              <div className="space-y-2 mt-4 pt-3 border-t">
                {incomingAmbulances.map((amb) => (
                  <div key={amb.ambulance_id} className="text-sm">
                    <p className="font-medium">{amb.vehicle_number}</p>
                    <p className="text-muted-foreground text-xs">Patient: {amb.patient_name}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Update Beds Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Update Bed Availability</CardTitle>
          <CardDescription>Update the number of available beds at your hospital</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateBeds} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="available-beds">Available Regular Beds</Label>
                <Input
                  id="available-beds"
                  type="number"
                  min="0"
                  max={hospital.total_beds}
                  value={bedData.available_beds}
                  onChange={(e) => setBedData({ ...bedData, available_beds: parseInt(e.target.value) || 0 })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: {hospital.total_beds} beds
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="available-icu-beds">Available ICU Beds</Label>
                <Input
                  id="available-icu-beds"
                  type="number"
                  min="0"
                  max={hospital.icu_beds}
                  value={bedData.available_icu_beds}
                  onChange={(e) => setBedData({ ...bedData, available_icu_beds: parseInt(e.target.value) || 0 })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Maximum: {hospital.icu_beds} ICU beds
                </p>
              </div>
            </div>
            <Button type="submit" disabled={updating}>
              {updating ? "Updating..." : "Update Availability"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Ambulances Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ambulance className="h-5 w-5 text-primary" />
            <CardTitle>Assigned Ambulances</CardTitle>
          </div>
          <CardDescription>Ambulances assigned to this hospital</CardDescription>
        </CardHeader>
        <CardContent>
          {ambulances.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No ambulances registered</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Vehicle Number</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Patient</th>
                    <th className="text-left py-3 px-4">Current Location</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ambulances.map((ambulance) => (
                    <tr key={ambulance.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{ambulance.vehicle_number}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ambulance.status} type="ambulance" />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {ambulance.patient_name || "-"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {ambulance.current_location || "Not reported"}
                      </td>
                      <td className="py-3 px-4">
                        {ambulance.status === "busy" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleReleaseAmbulance(ambulance.id, ambulance.emergency_report_id || null)}
                          >
                            Release
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
