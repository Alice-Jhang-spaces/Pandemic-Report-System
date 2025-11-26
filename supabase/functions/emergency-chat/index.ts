import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a friendly emergency medical assistant chatbot. Your job is to collect the following information from patients who need emergency medical help:

1. Patient Name (full name)
2. Patient Age (number)
3. Patient Phone (contact number)
4. Severity (must be one of: "critical", "high", "medium", "low")
5. Patient Address (full address)
6. Pickup Location (where ambulance should pick them up)
7. Symptoms (detailed description of medical issue)

Guide the conversation naturally, ask one or two questions at a time, be empathetic and calm.

Once you have ALL 7 pieces of information, respond with EXACTLY this format on separate lines:
SUBMIT_REPORT
Name: [patient name]
Age: [patient age]
Phone: [patient phone]
Severity: [critical/high/medium/low]
Address: [patient address]
Pickup: [pickup location]
Symptoms: [symptoms description]

IMPORTANT: 
- Severity must be exactly one of: "critical", "high", "medium", or "low"
- Be conversational and reassuring
- Only use the SUBMIT_REPORT format when you have ALL information
- Confirm critical details before submitting`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ]
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    // Security: Do not log patient data
    
    const aiMessage = data.choices[0].message.content;
    
    // Check if AI is submitting a report (contains SUBMIT_REPORT marker)
    if (aiMessage.includes("SUBMIT_REPORT")) {
      try {
        // Parse the structured response
        const lines = aiMessage.split('\n');
        const reportData: any = {};
        
        for (const line of lines) {
          if (line.startsWith('Name:')) reportData.patient_name = line.replace('Name:', '').trim();
          if (line.startsWith('Age:')) reportData.patient_age = parseInt(line.replace('Age:', '').trim());
          if (line.startsWith('Phone:')) reportData.patient_phone = line.replace('Phone:', '').trim();
          if (line.startsWith('Severity:')) reportData.severity = line.replace('Severity:', '').trim().toLowerCase();
          if (line.startsWith('Address:')) reportData.patient_address = line.replace('Address:', '').trim();
          if (line.startsWith('Pickup:')) reportData.pickup_location = line.replace('Pickup:', '').trim();
          if (line.startsWith('Symptoms:')) reportData.symptoms = line.replace('Symptoms:', '').trim();
        }

        // Validate required fields
        if (!reportData.patient_name || !reportData.patient_age || !reportData.patient_phone || 
            !reportData.severity || !reportData.patient_address || !reportData.pickup_location || 
            !reportData.symptoms) {
          throw new Error("Missing required fields in report");
        }

        // SECURITY FIX: Validate data types and ranges
        if (typeof reportData.patient_age !== 'number' || reportData.patient_age < 0 || reportData.patient_age > 150) {
          throw new Error("Invalid patient age");
        }

        if (!['critical', 'high', 'medium', 'low'].includes(reportData.severity)) {
          throw new Error("Invalid severity level");
        }

        if (reportData.patient_name.length > 100 || reportData.symptoms.length > 2000 ||
            reportData.patient_address.length > 500 || reportData.pickup_location.length > 500) {
          throw new Error("Field length exceeds maximum allowed");
        }

        // Validate data constraints
        if (reportData.patient_age < 0 || reportData.patient_age > 150) {
          throw new Error("Invalid patient age");
        }
        if (!['critical', 'high', 'medium', 'low'].includes(reportData.severity)) {
          throw new Error("Invalid severity level");
        }
        if (reportData.patient_name.trim().length > 100) {
          throw new Error("Patient name too long");
        }
        if (reportData.symptoms.trim().length > 2000) {
          throw new Error("Symptoms description too long");
        }
        if (reportData.patient_address && reportData.patient_address.trim().length > 500) {
          throw new Error("Address too long");
        }
        if (reportData.pickup_location.trim().length > 500) {
          throw new Error("Pickup location too long");
        }

        // Validate data formats
        const validSeverities = ['critical', 'high', 'medium', 'low'];
        if (!validSeverities.includes(reportData.severity)) {
          reportData.severity = 'medium'; // Default to medium if invalid
        }

        // Validate age range
        if (reportData.patient_age < 0 || reportData.patient_age > 150) {
          throw new Error("Invalid patient age");
        }

        // Validate string lengths
        if (reportData.patient_name.length > 100 || 
            reportData.symptoms.length > 2000 ||
            reportData.patient_address.length > 500 ||
            reportData.pickup_location.length > 500) {
          throw new Error("Input exceeds maximum length");
        }

        // Create emergency report in database
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: report, error: reportError } = await supabase
          .from("emergency_reports")
          .insert({
            patient_name: reportData.patient_name,
            patient_age: reportData.patient_age,
            patient_phone: reportData.patient_phone,
            severity: reportData.severity,
            patient_address: reportData.patient_address,
            pickup_location: reportData.pickup_location,
            symptoms: reportData.symptoms,
            status: "reported"
          })
          .select()
          .single();

        if (reportError) {
          console.error("Database error:", reportError);
          return new Response(JSON.stringify({ 
            error: "Failed to create emergency report",
            content: "I apologize, there was an error saving your emergency report. Please try again or call emergency services directly."
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          content: `✅ Emergency report created successfully!\n\nYour case has been submitted and our team will dispatch help immediately.\n\nReport ID: ${report.id.slice(0, 8)}\n\nAn ambulance will be assigned to ${reportData.pickup_location} shortly. Stay calm and keep your phone nearby.`,
          reportCreated: true,
          reportId: report.id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseError) {
        console.error("Parse error:", parseError);
        // If parsing fails, return the AI message anyway
        return new Response(JSON.stringify({ 
          content: aiMessage.replace("SUBMIT_REPORT", "").trim()
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Return AI response
    return new Response(JSON.stringify({ 
      content: aiMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});