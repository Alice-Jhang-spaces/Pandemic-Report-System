import { z } from 'zod';

// SECURITY: Enhanced validation schema for emergency reports
export const emergencyReportSchema = z.object({
  patient_name: z.string()
    .trim()
    .min(1, "Patient name is required")
    .max(100, "Patient name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  patient_age: z.number()
    .int("Age must be a whole number")
    .min(0, "Age cannot be negative")
    .max(150, "Please enter a valid age"),
  patient_phone: z.string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be less than 15 digits")
    .regex(/^\+?[1-9]\d{9,14}$/, "Please enter a valid international phone number (e.g., +1234567890)"),
  symptoms: z.string()
    .trim()
    .min(10, "Please provide at least 10 characters describing symptoms")
    .max(2000, "Symptoms description must be less than 2000 characters"),
  severity: z.enum(['critical', 'high', 'medium', 'low'], {
    errorMap: () => ({ message: "Severity must be critical, high, medium, or low" })
  }),
  patient_address: z.string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(500, "Address must be less than 500 characters"),
  pickup_location: z.string()
    .trim()
    .min(5, "Pickup location must be at least 5 characters")
    .max(500, "Pickup location must be less than 500 characters"),
});

export type EmergencyReportInput = z.infer<typeof emergencyReportSchema>;

// Ambulance validation schema
export const ambulanceSchema = z.object({
  vehicle_number: z.string()
    .trim()
    .min(1, "Vehicle number is required")
    .max(50, "Vehicle number must be less than 50 characters")
    .regex(/^[A-Z0-9-]+$/i, "Vehicle number can only contain letters, numbers, and hyphens"),
  current_location: z.string()
    .trim()
    .max(200, "Location must be less than 200 characters")
    .optional(),
});

export type AmbulanceInput = z.infer<typeof ambulanceSchema>;

// Partial schema for chatbot validation (may not have all fields initially)
export const emergencyReportPartialSchema = emergencyReportSchema.partial();
