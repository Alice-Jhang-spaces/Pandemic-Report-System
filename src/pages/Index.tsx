import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { EmergencyChatbot } from "@/components/EmergencyChatbot";
import { Activity, Ambulance, Building2, BarChart3, Shield, Clock, Search, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroImage from "@/assets/hero-emergency.jpg";

const Index = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [mapboxToken] = useState("pk.eyJ1IjoiYWxpY2VqaGFuZyIsImEiOiJjbTZpbHRjOW4wMjJkMmlvbmoxeWF6eWpnIn0.JMp5HPWWRTMATvyxuS1s8Q");
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    fetchHospitals();
    fetchAmbulances();

    // Subscribe to real-time updates for ambulances and hospitals
    const ambulancesChannel = supabase
      .channel("ambulances-public-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, () => {
        fetchAmbulances();
      })
      .subscribe();

    const hospitalsChannel = supabase
      .channel("hospitals-public-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, () => {
        fetchHospitals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ambulancesChannel);
      supabase.removeChannel(hospitalsChannel);
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add hospital markers
    hospitals.forEach((hospital) => {
      if (hospital.latitude && hospital.longitude) {
        const el = document.createElement("div");
        el.className = "hospital-marker";
        el.style.backgroundImage = "url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)";
        el.style.width = "32px";
        el.style.height = "40px";
        el.style.backgroundSize = "100%";

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-2">
            <h3 class="font-bold">${hospital.name}</h3>
            <p class="text-sm">${hospital.address}</p>
            <p class="text-sm mt-1">Available Beds: ${hospital.available_beds}/${hospital.total_beds}</p>
            <p class="text-sm">ICU Beds: ${hospital.available_icu_beds}/${hospital.icu_beds}</p>
          </div>`
        );

        const marker = new mapboxgl.Marker(el)
          .setLngLat([hospital.longitude, hospital.latitude])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current.push(marker);
      }
    });

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [mapboxToken, hospitals]);

  const fetchHospitals = async () => {
    try {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .order("name");

      if (error) throw error;
      setHospitals(data || []);
    } catch (error: any) {
      console.error("Failed to fetch hospitals:", error);
    }
  };

  const fetchAmbulances = async () => {
    try {
      const { data, error } = await supabase
        .from("ambulances")
        .select("*");

      if (error) throw error;
      setAmbulances(data || []);
    } catch (error: any) {
      console.error("Failed to fetch ambulances:", error);
    }
  };

  const handleZipCodeSearch = async () => {
    if (!zipCode.trim()) {
      toast.error("Please enter a zip code");
      return;
    }

    try {
      // Use Mapbox Geocoding API to convert zip code to coordinates
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipCode}.json?access_token=${mapboxToken}&country=US`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.current?.flyTo({
          center: [lng, lat],
          zoom: 12,
          essential: true,
        });
        toast.success("Location found!");
      } else {
        toast.error("Zip code not found");
      }
    } catch (error) {
      toast.error("Failed to search location");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Emergency Management Center" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 to-background/70" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Pandemic Reporting & Emergency Management System
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              A centralized healthcare platform connecting ambulances, hospitals, and health authorities 
              for real-time resource tracking and emergency response coordination.
            </p>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => setChatOpen(true)}>
                Get Started
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/dashboard">View Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Ambulance className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Available Ambulances
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {ambulances.filter(a => a.status === "available").length}
                  <span className="text-lg text-muted-foreground font-normal"> / {ambulances.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Hospitals
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {hospitals.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Available Beds
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {hospitals.reduce((sum, h) => sum + h.available_beds, 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4">Find Nearby Hospitals</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Search by zip code to find hospitals near you and check their bed availability
            </p>
          </div>

          {/* Zip Code Search */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter zip code (e.g., 10001)"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleZipCodeSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleZipCodeSearch}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {/* Map Container */}
          <div className="w-full h-[600px] rounded-lg overflow-hidden shadow-lg border">
            <div ref={mapContainer} className="w-full h-full" />
          </div>

          {/* Hospital List */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {hospitals.map((hospital) => (
              <Card key={hospital.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-start gap-2">
                    <Building2 className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                    {hospital.name}
                  </CardTitle>
                  <CardDescription>{hospital.address}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regular Beds:</span>
                      <span className="font-medium">
                        {hospital.available_beds}/{hospital.total_beds}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ICU Beds:</span>
                      <span className="font-medium">
                        {hospital.available_icu_beds}/{hospital.icu_beds}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium">{hospital.phone}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The Challenge</h2>
            <p className="text-lg text-muted-foreground">
              During the COVID-19 pandemic in Taiwan, the healthcare system faced critical challenges 
              due to an influx of patients and limited resource visibility.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <Ambulance className="h-12 w-12 text-warning mb-4" />
                <CardTitle>Unknown Ambulance Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Emergency services had no real-time visibility of available ambulances, 
                  leading to delays in patient transport and inefficient resource allocation.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Building2 className="h-12 w-12 text-destructive mb-4" />
                <CardTitle>Hidden Hospital Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Hospitals couldn't communicate bed availability in real-time, resulting in 
                  patients being transported to facilities that were already at capacity.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Solution</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              PREMS connects all stakeholders in the emergency response ecosystem with 
              real-time data and seamless coordination.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Activity className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Real-Time Resource Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor ambulance availability and hospital bed capacity in real-time 
                  across all facilities in the network.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Role-Based Access</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Secure, role-specific dashboards for ambulance operators, hospital staff, 
                  and CDC administrators with appropriate permissions.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Instant Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatic synchronization ensures all stakeholders have access to the 
                  latest information for informed decision-making.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive analytics and reporting tools for CDC administrators to 
                  track system performance and resource utilization.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Ambulance className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Emergency Dispatch</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Efficient emergency reporting and dispatch system that connects patients, 
                  ambulances, and hospitals seamlessly.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Building2 className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Hospital Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Easy-to-use interface for hospitals to update bed availability, 
                  ICU capacity, and receive incoming patient information.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Emergency Response?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join the platform that's streamlining healthcare coordination and saving lives 
            through better resource management.
          </p>
          <Button size="lg" variant="secondary" onClick={() => setChatOpen(true)}>
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 PREMS. Built to improve emergency healthcare coordination.</p>
        </div>
      </footer>

      <EmergencyChatbot isOpen={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
};

export default Index;
