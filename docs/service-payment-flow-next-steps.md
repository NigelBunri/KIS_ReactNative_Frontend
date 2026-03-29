# Service Payment Flow Next Steps

- **Phase 3 (Complaint/dispute capture & linkage)**
  - Build the complaint form and API backed by the `ServiceBookingComplaint` model, ensuring it links to the booking/payment IDs and stores personal statements, receipt reference, etc.
  - Ensure the complaint UI renders inside the booking details during the 3-day countdown with a “Send complaint” button.
  - Track complaint statuses (`submitted`, `under_review`, `resolved_release_provider`, `resolved_refund_customer`, `rejected`) for use by admins.
