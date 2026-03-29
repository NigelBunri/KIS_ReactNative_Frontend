import type {
  HealthDashboardInstitutionType,
  OperationalModule,
  ServiceDefinition,
} from './models';

const createService = (id: string, name: string, description: string): ServiceDefinition => ({
  id,
  name,
  description,
  active: true,
});

const createModule = (id: string, title: string, description: string): OperationalModule => ({
  id,
  title,
  description,
  enabled: true,
});

export const HEALTH_DASHBOARD_DEFAULT_SERVICES: Record<HealthDashboardInstitutionType, ServiceDefinition[]> = {
  clinic: [
    createService('general_consultation', 'General consultation', 'Outpatient general consultation.'),
    createService('pediatric_consultation', 'Pediatric consultation', 'Child-focused clinic consultation.'),
    createService('antenatal_care', 'Antenatal care', 'Prenatal monitoring and care.'),
    createService('vaccination', 'Vaccination', 'Routine immunization service.'),
    createService('minor_procedures', 'Minor procedures', 'Low-risk outpatient procedures.'),
    createService('teleconsultation', 'Teleconsultation', 'Remote virtual consultation service.'),
  ],
  hospital: [
    createService('emergency_care', 'Emergency care', 'Acute emergency intake and treatment.'),
    createService('surgery_booking', 'Surgery booking', 'Surgical consultation and scheduling.'),
    createService('specialist_consultation', 'Specialist consultation', 'Consultation by department specialists.'),
    createService('inpatient_admission', 'Inpatient admission', 'Inpatient ward admission workflow.'),
    createService('icu', 'ICU', 'Critical care service line.'),
    createService('maternity', 'Maternity', 'Maternal and neonatal care services.'),
    createService('imaging', 'Imaging', 'Diagnostic imaging referral service.'),
    createService('lab_request', 'Lab request', 'Laboratory test request coordination.'),
  ],
  lab: [
    createService('blood_test', 'Blood test', 'General blood sampling and analysis.'),
    createService('hormone_panel', 'Hormone panel', 'Hormonal diagnostics panel.'),
    createService('full_blood_count', 'Full blood count', 'Complete blood count processing.'),
    createService('pcr_test', 'PCR test', 'Molecular PCR diagnostics.'),
    createService('urine_analysis', 'Urine analysis', 'Urinalysis and report generation.'),
    createService('home_sample_pickup', 'Home sample pickup', 'Home collection logistics.'),
  ],
  diagnostics: [
    createService('xray', 'X-ray', 'Radiographic imaging service.'),
    createService('mri', 'MRI', 'Magnetic resonance imaging service.'),
    createService('ct_scan', 'CT Scan', 'Computed tomography service.'),
    createService('ultrasound', 'Ultrasound', 'Ultrasound scan service.'),
    createService('mammogram', 'Mammogram', 'Breast imaging screening service.'),
    createService('ecg', 'ECG', 'Cardiac electrical tracing service.'),
  ],
  pharmacy: [
    createService('prescription_fulfillment', 'Prescription fulfillment', 'Prescription verification and dispensing.'),
    createService('otc_purchase', 'OTC purchase', 'Over-the-counter medication sales.'),
    createService('chronic_medication_refill', 'Chronic medication refill', 'Refill workflow for chronic care.'),
    createService('home_delivery', 'Home delivery', 'Medication delivery logistics.'),
  ],
  wellness_center: [
    createService('nutrition_consultation', 'Nutrition consultation', 'Dietary planning and counseling.'),
    createService('fitness_program', 'Fitness program', 'Guided fitness and movement plans.'),
    createService('stress_management_session', 'Stress management session', 'Stress reduction coaching.'),
    createService('weight_loss_program', 'Weight loss program', 'Weight management program enrollment.'),
    createService('mental_wellness_session', 'Mental wellness session', 'Mental wellness support session.'),
    createService('wellness_challenge_enrollment', 'Wellness challenge enrollment', 'Challenge and habit program enrollment.'),
  ],
};

export const HEALTH_DASHBOARD_DEFAULT_OPERATIONAL_MODULES: Record<
  HealthDashboardInstitutionType,
  OperationalModule[]
> = {
  clinic: [
    createModule('patient_intake_flow_analytics', 'Patient Intake Flow Analytics', 'Track intake throughput and wait stages.'),
    createModule('referral_tracking', 'Referral Tracking', 'Monitor referral source and completion pipeline.'),
    createModule('care_team_assignment_board', 'Care Team Assignment Board', 'Assign clinicians to daily care queues.'),
    createModule('chronic_patient_tracking', 'Chronic Patient Tracking', 'Track longitudinal chronic-care adherence.'),
    createModule('repeat_visit_monitoring', 'Repeat Visit Monitoring', 'Monitor and optimize repeat visit rates.'),
  ],
  hospital: [
    createModule('bed_occupancy_dashboard', 'Bed Occupancy Dashboard', 'Realtime occupancy by ward and unit.'),
    createModule('department_analytics', 'Department Analytics', 'Cross-department performance telemetry.'),
    createModule('emergency_response_metrics', 'Emergency Response Metrics', 'Emergency triage response KPIs.'),
    createModule('surgery_pipeline_tracker', 'Surgery Pipeline Tracker', 'Pre-op to post-op surgery workflow tracker.'),
    createModule('insurance_claims_monitoring', 'Insurance Claims Monitoring', 'Claims status and denial tracking.'),
    createModule('clinical_event_logs', 'Clinical Event Logs', 'Operational and clinical event audit stream.'),
  ],
  lab: [
    createModule('test_order_lifecycle_tracker', 'Test Order Lifecycle Tracker', 'Order creation to result publishing status.'),
    createModule('sample_status_tracking', 'Sample Status Tracking', 'Sample collection and processing steps.'),
    createModule('result_turnaround_analytics', 'Result Turnaround Analytics', 'Turnaround time trend monitoring.'),
    createModule('equipment_usage_analytics', 'Equipment Usage Analytics', 'Analyzer utilization and downtime.'),
    createModule('lab_technician_performance', 'Lab Technician Performance', 'Workload and quality metrics per technician.'),
  ],
  diagnostics: [
    createModule('imaging_slot_utilization', 'Imaging Slot Utilization', 'Scanner appointment slot efficiency.'),
    createModule('radiologist_reporting_queue', 'Radiologist Reporting Queue', 'Report queue and backlog controls.'),
    createModule('equipment_load_metrics', 'Equipment Load Metrics', 'Device load and maintenance pressure.'),
    createModule('report_turnaround_time', 'Report Turnaround Time', 'Imaging report delivery speed metrics.'),
    createModule('referral_sources_heatmap', 'Referral Sources Heatmap', 'Referral channel concentration analysis.'),
  ],
  pharmacy: [
    createModule('inventory_health_dashboard', 'Inventory Health Dashboard', 'Stock health, movement, and wastage.'),
    createModule('low_stock_alerts', 'Low Stock Alerts', 'Threshold-based low stock notifications.'),
    createModule('expiry_tracking', 'Expiry Tracking', 'Expiry horizon and near-expiry items.'),
    createModule('prescription_verification_logs', 'Prescription Verification Logs', 'Verification compliance logs.'),
    createModule('refill_compliance_analytics', 'Refill Compliance Analytics', 'Refill adherence and drop-off trends.'),
    createModule('revenue_per_medication_category', 'Revenue per Medication Category', 'Revenue decomposition by drug class.'),
  ],
  wellness_center: [
    createModule('program_enrollment_analytics', 'Program Enrollment Analytics', 'Enrollment and retention by program.'),
    createModule('habit_tracking_metrics', 'Habit Tracking Metrics', 'Habit completion and adherence trends.'),
    createModule('client_progress_reports', 'Client Progress Reports', 'Progress summaries across cohorts.'),
    createModule('subscription_tracking', 'Subscription Tracking', 'Subscription lifecycle and churn signals.'),
    createModule('wellness_challenge_leaderboard', 'Wellness Challenge Leaderboard', 'Challenge rankings and engagement.'),
  ],
};
