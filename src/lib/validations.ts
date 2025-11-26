import { z } from "zod";

// Emergency report validation schema
export const emergencyReportSchema = z.object({
  patient_name: z
    .string()
    .trim()
    .min(1, "Patient name is required")
    .max(100, "Patient name must be less than 100 characters"),
  patient_age: z
    .number()
    .int("Age must be a whole number")
    .min(0, "Age cannot be negative")
    .max(150, "Age must be less than 150"),
  patient_phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(20, "Phone number is too long"),
  severity: z.enum(["critical", "high", "medium", "low"], {
    errorMap: () => ({ message: "Severity must be critical, high, medium, or low" }),
  }),
  patient_address: z
    .string()
    .trim()
    .min(1, "Patient address is required")
    .max(500, "Address must be less than 500 characters"),
  pickup_location: z
    .string()
    .trim()
    .min(1, "Pickup location is required")
    .max(500, "Pickup location must be less than 500 characters"),
  symptoms: z
    .string()
    .trim()
    .min(1, "Symptoms description is required")
    .max(2000, "Symptoms description must be less than 2000 characters"),
});

export type EmergencyReportInput = z.infer<typeof emergencyReportSchema>;

// Hospital code validation
export const hospitalCodeSchema = z
  .string()
  .trim()
  .min(1, "Hospital code is required")
  .max(50, "Hospital code is too long");

// Ambulance validation
export const ambulanceSchema = z.object({
  vehicle_number: z
    .string()
    .trim()
    .min(1, "Vehicle number is required")
    .max(50, "Vehicle number must be less than 50 characters"),
  current_location: z
    .string()
    .trim()
    .max(200, "Location must be less than 200 characters")
    .optional(),
});

export type AmbulanceInput = z.infer<typeof ambulanceSchema>;
