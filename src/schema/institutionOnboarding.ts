export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'map'
  | 'url';

type UploadConstraint = {
  mimeTypes: string[];
  maxSizeMB: number;
  signedUrl?: boolean;
  virusScan?: boolean;
};

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  helper?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: RegExp;
  upload?: UploadConstraint;
  multiple?: boolean;
};

export type SectionDefinition = {
  id: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
};

export type FeatureBanner = {
  title: string;
  description: string;
  regulatoryNotes: string[];
  requiredDocuments: string[];
  safetyControls: string[];
  estimatedApproval: string;
};

export type InstitutionSchema = {
  type: string;
  banner: FeatureBanner;
  sections: SectionDefinition[];
};

export const FILE_CONSTRAINTS: Record<string, UploadConstraint> = {
  document: {
    mimeTypes: ['application/pdf'],
    maxSizeMB: 15,
    signedUrl: true,
    virusScan: true,
  },
  image: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
    maxSizeMB: 8,
    signedUrl: true,
    virusScan: true,
  },
};

const baseSections: SectionDefinition[] = [
  {
    id: 'identity',
    title: 'Identity & Legal',
    fields: [
      { key: 'name', label: 'Institution Name', type: 'text', required: true },
      { key: 'registration_number', label: 'Registration Number', type: 'text', required: true },
      {
        key: 'business_type',
        label: 'Business Type',
        type: 'select',
        required: true,
        options: [
          { value: 'llc', label: 'LLC' },
          { value: 'sole_prop', label: 'Sole Proprietorship' },
          { value: 'gov', label: 'Government' },
          { value: 'ngo', label: 'NGO' },
        ],
      },
      { key: 'tax_id', label: 'Tax ID', type: 'text', required: true },
      { key: 'year_established', label: 'Year Established', type: 'number', required: true },
      { key: 'ownership_structure', label: 'Ownership Structure', type: 'textarea', required: true },
      { key: 'primary_contact', label: 'Primary Contact Person', type: 'text', required: true },
      { key: 'owner_government_id', label: 'Government ID of Owner', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      { key: 'business_registration_certificate', label: 'Business Registration Certificate', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      { key: 'proof_of_address', label: 'Proof of Address', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
    ],
  },
  {
    id: 'location',
    title: 'Location',
    fields: [
      { key: 'physical_address', label: 'Physical Address', type: 'textarea', required: true },
      { key: 'country', label: 'Country', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'postal_code', label: 'Postal Code', type: 'text', required: true },
      { key: 'geolocation', label: 'Google Maps Location', type: 'map', required: true, helper: 'Drag the pin to confirm coordinates' },
      { key: 'service_radius', label: 'Service Radius (km)', type: 'number', required: true },
      { key: 'branches', label: 'Additional Branches', type: 'textarea', required: false, helper: 'List branch addresses if any' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    fields: [
      { key: 'official_email', label: 'Official Email', type: 'email', required: true },
      { key: 'phone_number', label: 'Phone Number', type: 'phone', required: true },
      { key: 'emergency_line', label: 'Emergency Contact Line', type: 'phone', required: true },
      { key: 'website', label: 'Website', type: 'url', required: false },
      { key: 'social_links', label: 'Social Links', type: 'url', required: false, multiple: true },
    ],
  },
  {
    id: 'media',
    title: 'Media',
    fields: [
      { key: 'logo', label: 'Logo Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.image },
      { key: 'facility_photos', label: 'Facility Photos', type: 'file', required: true, upload: FILE_CONSTRAINTS.image, multiple: true },
      { key: 'interior_images', label: 'Interior Images', type: 'file', required: true, upload: FILE_CONSTRAINTS.image, multiple: true },
      { key: 'license_display_image', label: 'License Display Image', type: 'file', required: true, upload: FILE_CONSTRAINTS.image },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Safety',
    fields: [
      { key: 'malpractice_insurance', label: 'Malpractice Insurance', type: 'file', required: false, upload: FILE_CONSTRAINTS.document },
      { key: 'indemnity_insurance', label: 'Professional Indemnity Insurance', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      { key: 'data_protection_officer', label: 'Data Protection Officer Name', type: 'text', required: true },
      { key: 'telemedicine_consent', label: 'Telemedicine Consent Agreement', type: 'file', required: false, upload: FILE_CONSTRAINTS.document, helper: 'Required for telemedicine providers' },
      { key: 'emergency_escalation_protocol', label: 'Emergency Escalation Protocol', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      { key: 'infection_control_policy', label: 'Infection Control Policy', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      { key: 'incident_reporting_policy', label: 'Incident Reporting Policy', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
    ],
  },
];

const typeCustomizations: Record<string, SectionDefinition[]> = {
  clinic: [
    {
      id: 'clinic_details',
      title: 'Clinic Details',
      fields: [
        { key: 'clinic_type', label: 'Clinic Type', type: 'select', required: true, options: [
          { value: 'general', label: 'General' },
          { value: 'family', label: 'Family' },
          { value: 'private', label: 'Private' },
          { value: 'walk_in', label: 'Walk-in' },
        ] },
        { key: 'consultation_rooms', label: 'Consultation Rooms', type: 'number', required: true },
        { key: 'licensed_doctors', label: 'Licensed Doctors', type: 'number', required: true },
        { key: 'doctors_list', label: 'Doctors List (Name, License #)', type: 'textarea', required: true },
        { key: 'ehr_system', label: 'EHR System', type: 'text', required: true },
        { key: 'pharmacy_attached', label: 'Pharmacy Attached', type: 'radio', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { key: 'lab_attached', label: 'Lab Attached', type: 'radio', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { key: 'patient_capacity', label: 'Patient Capacity / Day', type: 'number', required: true },
      ],
    },
  ],
  hospital: [
    {
      id: 'hospital_details',
      title: 'Hospital Details',
      fields: [
        { key: 'hospital_category', label: 'Hospital Category', type: 'select', required: true, options: [
          { value: 'primary', label: 'Primary' },
          { value: 'secondary', label: 'Secondary' },
          { value: 'tertiary', label: 'Tertiary' },
        ] },
        { key: 'bed_capacity', label: 'Bed Capacity', type: 'number', required: true },
        { key: 'icu_beds', label: 'ICU Beds', type: 'number', required: true },
        { key: 'emergency_department', label: 'Emergency Department', type: 'radio', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { key: 'surgery_theatres', label: 'Surgery Theatres', type: 'number', required: true },
        { key: 'departments', label: 'Departments', type: 'textarea', required: true },
        { key: 'chief_medical_director', label: 'Chief Medical Director Details', type: 'textarea', required: true },
        { key: 'accreditation_certificates', label: 'Accreditation Certificates (PDF)', type: 'file', required: true, upload: FILE_CONSTRAINTS.document, multiple: true },
      ],
    },
  ],
  laboratory: [
    {
      id: 'lab_details',
      title: 'Laboratory Details',
      fields: [
        { key: 'lab_type', label: 'Lab Type', type: 'text', required: true },
        { key: 'license_number', label: 'License Number', type: 'text', required: true, validation: /^[A-Z]{2}\d{6}$/ },
        { key: 'lab_director', label: 'Lab Director Details', type: 'textarea', required: true },
        { key: 'equipment_list', label: 'Equipment List', type: 'textarea', required: true },
        { key: 'calibration_certification', label: 'Calibration Certification', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'cold_chain_compliance', label: 'Cold Chain Compliance', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'sample_pickup', label: 'Sample Pickup Service', type: 'radio', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      ],
    },
  ],
  pharmacy: [
    {
      id: 'pharmacy_details',
      title: 'Pharmacy Details',
      fields: [
        { key: 'pharmacy_license', label: 'Pharmacy License', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'superintendent_pharmacist', label: 'Superintendent Pharmacist Details', type: 'textarea', required: true },
        { key: 'controlled_drug_license', label: 'Controlled Drug License', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'prescription_verification', label: 'Prescription Verification System', type: 'textarea', required: true },
        { key: 'cold_storage_capacity', label: 'Cold Storage Capacity (liters)', type: 'number', required: true },
        { key: 'inventory_system', label: 'Inventory Tracking System', type: 'text', required: true },
      ],
    },
  ],
  specialist_center: [
    {
      id: 'specialist_details',
      title: 'Specialist Center',
      fields: [
        { key: 'specialty_focus', label: 'Specialty Focus', type: 'text', required: true },
        { key: 'specialist_count', label: 'Number of Specialists', type: 'number', required: true },
        { key: 'referral_protocol', label: 'Referral Protocol', type: 'textarea', required: true },
      ],
    },
  ],
  telemedicine_provider: [
    {
      id: 'telemedicine_details',
      title: 'Telemedicine Provider',
      fields: [
        { key: 'virtual_platform', label: 'Telemedicine Platform', type: 'text', required: true },
        { key: 'consent_policy', label: 'Telemedicine Consent Policy', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'online_staff', label: 'Online Staff Count', type: 'number', required: true },
      ],
    },
  ],
  urgent_care_center: [
    {
      id: 'urgent_details',
      title: 'Urgent Care Details',
      fields: [
        { key: 'hours_weekend', label: 'Weekend Coverage (hours)', type: 'number', required: true },
        { key: 'triage_capacity', label: 'Triage Capacity', type: 'number', required: true },
      ],
    },
  ],
  rehabilitation_center: [
    {
      id: 'rehab_details',
      title: 'Rehabilitation Center',
      fields: [
        { key: 'therapy_types', label: 'Therapy Types', type: 'textarea', required: true },
        { key: 'bed_capacity', label: 'Bed Capacity', type: 'number', required: true },
      ],
    },
  ],
  physiotherapy_center: [
    {
      id: 'physio_details',
      title: 'Physiotherapy Center',
      fields: [
        { key: 'therapists_count', label: 'Therapists Count', type: 'number', required: true },
        { key: 'therapy_equipment', label: 'Therapy Equipment', type: 'textarea', required: true },
      ],
    },
  ],
  medical_supply_store: [
    {
      id: 'supply_details',
      title: 'Supply Store',
      fields: [
        { key: 'inventory_types', label: 'Inventory Types', type: 'textarea', required: true },
        { key: 'warranty_track', label: 'Warranty Tracking System', type: 'text', required: true },
      ],
    },
  ],
  wellness_center: [
    {
      id: 'wellness_details',
      title: 'Wellness Center',
      fields: [
        { key: 'programs_offered', label: 'Programs Offered', type: 'textarea', required: true },
        { key: 'wellness_coordinator', label: 'Wellness Coordinator', type: 'text', required: true },
      ],
    },
  ],
  mental_health_center: [
    {
      id: 'mental_health',
      title: 'Mental Health Center',
      fields: [
        { key: 'psychiatrists_count', label: 'Psychiatrists', type: 'number', required: true },
        { key: 'therapists_count', label: 'Therapists', type: 'number', required: true },
        { key: 'crisis_program', label: 'Crisis Intervention Program', type: 'radio', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { key: 'suicide_protocol', label: 'Suicide Escalation Protocol', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'confidentiality_policy', label: 'Confidentiality Policy Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      ],
    },
  ],
  nutrition_center: [
    {
      id: 'nutrition',
      title: 'Nutrition Center',
      fields: [
        { key: 'diet_programs', label: 'Diet Programs', type: 'textarea', required: true },
        { key: 'registered_dietitians', label: 'Registered Dietitians', type: 'number', required: true },
      ],
    },
  ],
  fitness_health_partner: [
    {
      id: 'fitness',
      title: 'Fitness Health Partner',
      fields: [
        { key: 'fitness_certifications', label: 'Certifications', type: 'textarea', required: true },
        { key: 'coach_count', label: 'Coaches', type: 'number', required: true },
      ],
    },
  ],
  home_care_provider: [
    {
      id: 'home_care',
      title: 'Home Care Provider',
      fields: [
        { key: 'service_radius_home', label: 'Home Service Radius (km)', type: 'number', required: true },
        { key: 'caregiver_count', label: 'Caregivers', type: 'number', required: true },
      ],
    },
  ],
  community_health_center: [
    {
      id: 'community',
      title: 'Community Health Center',
      fields: [
        { key: 'community_programs', label: 'Programs', type: 'textarea', required: true },
        { key: 'outreach_staff', label: 'Outreach Staff', type: 'number', required: true },
      ],
    },
  ],
  elderly_care_facility: [
    {
      id: 'elderly',
      title: 'Elderly Care Facility',
      fields: [
        { key: 'bed_capacity_elderly', label: 'Bed Capacity', type: 'number', required: true },
        { key: 'medical_staff', label: 'Medical Staff Count', type: 'number', required: true },
      ],
    },
  ],
  palliative_care_center: [
    {
      id: 'palliative',
      title: 'Palliative Care',
      fields: [
        { key: 'support_services', label: 'Support Services', type: 'textarea', required: true },
        { key: 'care_team', label: 'Care Team Composition', type: 'textarea', required: true },
      ],
    },
  ],
  emergency_response_unit: [
    {
      id: 'eru',
      title: 'Emergency Response Unit',
      fields: [
        { key: 'response_time_avg', label: 'Average Response Time (min)', type: 'number', required: true },
        { key: 'escalation_protocol', label: 'Emergency Escalation Protocol', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'fleet_size', label: 'Fleet Size', type: 'number', required: true },
      ],
    },
  ],
  ambulance_service: [
    {
      id: 'ambulance',
      title: 'Ambulance Service',
      fields: [
        { key: 'fleet_size_ambulance', label: 'Fleet Size', type: 'number', required: true },
        { key: 'ambulance_types', label: 'Ambulance Types (BLS/ALS)', type: 'textarea', required: true },
        { key: 'paramedic_count', label: 'Paramedics', type: 'number', required: true },
        { key: 'emergency_hotline', label: 'Emergency Hotline', type: 'phone', required: true },
        { key: 'response_time', label: 'Response Time (avg minutes)', type: 'number', required: true },
        { key: 'vehicle_registration', label: 'Vehicle Registration Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document, multiple: true },
        { key: 'paramedic_certifications', label: 'Paramedic Certifications', type: 'file', required: true, upload: FILE_CONSTRAINTS.document, multiple: true },
      ],
    },
  ],
  trauma_center: [
    {
      id: 'trauma',
      title: 'Trauma Center',
      fields: [
        { key: 'trauma_level', label: 'Trauma Level', type: 'select', required: true, options: [
          { value: 'level1', label: 'Level 1' },
          { value: 'level2', label: 'Level 2' },
          { value: 'level3', label: 'Level 3' },
        ] },
        { key: 'surgical_team', label: 'Surgical Team Size', type: 'number', required: true },
      ],
    },
  ],
  insurance_provider: [
    {
      id: 'insurance',
      title: 'Insurance Provider',
      fields: [
        { key: 'insurance_license', label: 'Insurance License Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'coverage_plans', label: 'Coverage Plans Offered', type: 'textarea', required: true },
        { key: 'claims_workflow', label: 'Claims Processing Workflow', type: 'textarea', required: true },
        { key: 'regulatory_approval', label: 'Regulatory Approval Document', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'fraud_policy', label: 'Fraud Detection Policy', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      ],
    },
  ],
  health_management_organization: [
    {
      id: 'hmo',
      title: 'Health Management Organization',
      fields: [
        { key: 'managed_networks', label: 'Managed Networks', type: 'textarea', required: true },
        { key: 'care_coordination', label: 'Care Coordination Strategy', type: 'textarea', required: true },
      ],
    },
  ],
  government_health_agency: [
    {
      id: 'government',
      title: 'Government Health Agency',
      fields: [
        { key: 'mandate_scope', label: 'Mandate Scope', type: 'textarea', required: true },
        { key: 'public_registry', label: 'Public Registry URL', type: 'url', required: true },
        { key: 'legal_mandate', label: 'Legal Mandate Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      ],
    },
  ],
  regulatory_body: [
    {
      id: 'regulatory',
      title: 'Regulatory Body',
      fields: [
        { key: 'authority_name', label: 'Governing Authority Name', type: 'text', required: true },
        { key: 'jurisdiction', label: 'Jurisdiction Scope', type: 'text', required: true },
        { key: 'license_verification_endpoint', label: 'License Verification API', type: 'url', required: true },
        { key: 'legal_mandate', label: 'Legal Mandate Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
      ],
    },
  ],
  accreditation_body: [
    {
      id: 'accreditation',
      title: 'Accreditation Body',
      fields: [
        { key: 'accreditation_standards', label: 'Accreditation Standards Upload', type: 'file', required: true, upload: FILE_CONSTRAINTS.document },
        { key: 'certification_process', label: 'Certification Process Description', type: 'textarea', required: true },
        { key: 'renewal_period', label: 'Renewal Period (months)', type: 'number', required: true },
        { key: 'auditor_list', label: 'Auditor List', type: 'textarea', required: false },
      ],
    },
  ],
};

const createSchema = (type: string, banner: FeatureBanner) => ({
  type,
  banner,
  sections: baseSections.concat(typeCustomizations[type] ?? []),
});

const banners: Record<string, FeatureBanner> = {
  clinic: {
    title: 'Clinic Onboarding',
    description: 'Capture base legal, location, and compliance controls plus clinic-specific staffing.',
    regulatoryNotes: ['Maintain malpractice coverage', 'Log every practitioner license'],
    requiredDocuments: ['clinic_license', 'malpractice_insurance', 'infection_control_policy', 'incident_reporting_policy'],
    safetyControls: ['Patient safety protocols', 'Incident triage log'],
    estimatedApproval: '5-7 business days',
  },
  hospital: {
    title: 'Hospital Onboarding',
    description: 'Track bed capacity, accreditation, and emergency readiness.',
    regulatoryNotes: ['Hospital accreditation and fire safety are mandatory'],
    requiredDocuments: ['hospital_accreditation', 'fire_safety_cert', 'biohazard_disposal_agreement'],
    safetyControls: ['Emergency department readiness', 'Biohazard disposal logs'],
    estimatedApproval: '10-14 business days',
  },
  laboratory: {
    title: 'Laboratory Onboarding',
    description: 'Document lab director, equipment calibration, and cold chain safeguards.',
    regulatoryNotes: ['Director license must be valid', 'Cold chain compliance is mandatory'],
    requiredDocuments: ['lab_director_license', 'calibration_certification', 'cold_chain_compliance'],
    safetyControls: ['Sample tracking', 'Calibration schedule'],
    estimatedApproval: '7-9 business days',
  },
  pharmacy: {
    title: 'Pharmacy Onboarding',
    description: 'Capture pharmaceutical licenses, controlled drug tracking, and inventory practices.',
    regulatoryNotes: ['Controlled drug license is required for every pharmacy'],
    requiredDocuments: ['pharmacy_license', 'controlled_drug_license'],
    safetyControls: ['Cold storage monitoring', 'Inventory audits'],
    estimatedApproval: '5-8 business days',
  },
  specialist_center: {
    title: 'Specialist Center',
    description: 'Detail specialty focus and referral cadences.',
    regulatoryNotes: ['Specialist centers must publish qualified specialists'],
    requiredDocuments: ['clinic_license', 'specialist_certificates'],
    safetyControls: ['Specialist hour logs'],
    estimatedApproval: '6-8 business days',
  },
  telemedicine_provider: {
    title: 'Telemedicine Provider',
    description: 'Ensure telehealth platforms, consent, and data protection are in place.',
    regulatoryNotes: ['Telemedicine consent upload required', 'Data protection officer must be listed'],
    requiredDocuments: ['telemedicine_consent', 'data_protection_policy'],
    safetyControls: ['Digital security controls', 'Session logging'],
    estimatedApproval: '5-7 business days',
  },
  urgent_care_center: {
    title: 'Urgent Care Center',
    description: 'Cover weekend coverage, triage, and escalation protocols.',
    regulatoryNotes: ['Emergency escalation protocol mandatory'],
    requiredDocuments: ['emergency_escalation_protocol'],
    safetyControls: ['Triage staffing log'],
    estimatedApproval: '6-8 business days',
  },
  rehabilitation_center: {
    title: 'Rehabilitation Center',
    description: 'Record therapies, medical staff support, and facility capacity.',
    regulatoryNotes: ['Medical oversight required'],
    requiredDocuments: ['therapy_certifications'],
    safetyControls: ['Therapy safety audits'],
    estimatedApproval: '7-9 business days',
  },
  physiotherapy_center: {
    title: 'Physiotherapy Center',
    description: 'Document therapists and foundational equipment lists.',
    regulatoryNotes: ['Therapist licenses must be on file'],
    requiredDocuments: ['therapist_licenses'],
    safetyControls: ['Equipment maintenance'],
    estimatedApproval: '6-8 business days',
  },
  medical_supply_store: {
    title: 'Medical Supply Store',
    description: 'Capture inventory governance and warranty tracking.',
    regulatoryNotes: ['Product liability compliance'],
    requiredDocuments: ['supply_license'],
    safetyControls: ['Inventory audits'],
    estimatedApproval: '5-7 business days',
  },
  wellness_center: {
    title: 'Wellness Center',
    description: 'Detail programs, coordinators, and wellness partnerships.',
    regulatoryNotes: ['Monitor wellness coaching certifications'],
    requiredDocuments: ['wellness_certifications'],
    safetyControls: ['Client satisfaction reporting'],
    estimatedApproval: '6-9 business days',
  },
  mental_health_center: {
    title: 'Mental Health Center',
    description: 'Capture staff counts, crisis programs, and confidentiality protocols.',
    regulatoryNotes: ['Confidentiality and crisis protocols required'],
    requiredDocuments: ['suicide_escalation_protocol', 'confidentiality_policy'],
    safetyControls: ['Crisis response logs'],
    estimatedApproval: '7-10 business days',
  },
  nutrition_center: {
    title: 'Nutrition Center',
    description: 'Record dietitians and program coverage.',
    regulatoryNotes: ['Nutrition services must track registered dietitians'],
    requiredDocuments: ['nutrition_program_audit'],
    safetyControls: ['Nutrition outcome reporting'],
    estimatedApproval: '5-7 business days',
  },
  fitness_health_partner: {
    title: 'Fitness Health Partner',
    description: 'Include certifications and coach counts.',
    regulatoryNotes: ['Fitness certifications are mandatory'],
    requiredDocuments: ['fitness_certifications'],
    safetyControls: ['Program safety audits'],
    estimatedApproval: '5-7 business days',
  },
  home_care_provider: {
    title: 'Home Care Provider',
    description: 'Document caregivers, radius, and protocols.',
    regulatoryNotes: ['Home-based care protocols must be available'],
    requiredDocuments: ['home_care_protocols'],
    safetyControls: ['Home visit checklists'],
    estimatedApproval: '6-8 business days',
  },
  community_health_center: {
    title: 'Community Health Center',
    description: 'Capture outreach programs and community staff.',
    regulatoryNotes: ['Community outreach reporting'],
    requiredDocuments: ['community_program_plan'],
    safetyControls: ['Outreach dashboards'],
    estimatedApproval: '6-8 business days',
  },
  elderly_care_facility: {
    title: 'Elderly Care Facility',
    description: 'Record bed counts, medical staff, and family protocols.',
    regulatoryNotes: ['Elder-care licensing required'],
    requiredDocuments: ['eldercare_license'],
    safetyControls: ['Caregiver training records'],
    estimatedApproval: '7-9 business days',
  },
  palliative_care_center: {
    title: 'Palliative Care Center',
    description: 'Record support services and care team.',
    regulatoryNotes: ['Palliative protocols must be accessible'],
    requiredDocuments: ['palliative_documentation'],
    safetyControls: ['Support service audits'],
    estimatedApproval: '7-10 business days',
  },
  emergency_response_unit: {
    title: 'Emergency Response Unit',
    description: 'Detail response times, fleet, and escalation protocols.',
    regulatoryNotes: ['Escalation protocol required'],
    requiredDocuments: ['emergency_escalation_protocol'],
    safetyControls: ['Incident reporting'],
    estimatedApproval: '5-7 business days',
  },
  ambulance_service: {
    title: 'Ambulance Service',
    description: 'Document fleet, paramedics, approvals, and response KPI.',
    regulatoryNotes: ['Vehicle registrations and paramedic certifications are compulsory'],
    requiredDocuments: ['vehicle_registration', 'paramedic_certifications'],
    safetyControls: ['Vehicle maintenance logs'],
    estimatedApproval: '5-8 business days',
  },
  trauma_center: {
    title: 'Trauma Center',
    description: 'Capture trauma level, surgical teams, and readiness measures.',
    regulatoryNotes: ['Trauma level accreditation required'],
    requiredDocuments: ['trauma_plan'],
    safetyControls: ['Surgical safety protocols'],
    estimatedApproval: '7-10 business days',
  },
  insurance_provider: {
    title: 'Insurance Provider',
    description: 'Document licenses, claims workflows, and fraud controls.',
    regulatoryNotes: ['Insurance license + regulatory approval required'],
    requiredDocuments: ['insurance_license', 'regulatory_approval', 'fraud_policy'],
    safetyControls: ['Claims audit logs'],
    estimatedApproval: '8-12 business days',
  },
  health_management_organization: {
    title: 'Health Management Organization',
    description: 'Document managed networks and care coordination.',
    regulatoryNotes: ['Care coordination strategy is required'],
    requiredDocuments: ['hmo_certification'],
    safetyControls: ['Network performance dashboards'],
    estimatedApproval: '6-9 business days',
  },
  government_health_agency: {
    title: 'Government Health Agency',
    description: 'Capture mandate, public registry, and legal uploads.',
    regulatoryNotes: ['Legal mandate document required'],
    requiredDocuments: ['legal_mandate_document'],
    safetyControls: ['Public transparency logs'],
    estimatedApproval: '7-11 business days',
  },
  regulatory_body: {
    title: 'Regulatory Body',
    description: 'Document authority, jurisdiction, and verification endpoints.',
    regulatoryNotes: ['Public registry + legal mandates must be submitted'],
    requiredDocuments: ['legal_mandate_document'],
    safetyControls: ['License verification audit'],
    estimatedApproval: '8-12 business days',
  },
  accreditation_body: {
    title: 'Accreditation Body',
    description: 'Record standards, processes, and auditor details.',
    regulatoryNotes: ['Accreditation standards upload required'],
    requiredDocuments: ['accreditation_standards'],
    safetyControls: ['Certification review logs'],
    estimatedApproval: '7-10 business days',
  },
};

export const institutionSchemaMap = Object.keys(banners).map<InstitutionSchema>((type) =>
  createSchema(type, banners[type]),
).reduce<Record<string, InstitutionSchema>>((acc, schema) => {
  acc[schema.type] = schema;
  return acc;
}, {} as Record<string, InstitutionSchema>);

export const allInstitutionTypes = Object.keys(banners);
