# Service Payment Flow Master Plan

This project breaks the service booking/payment/dispute lifecycle into focused, verifiable phases. Each phase builds on the previous while keeping the booking and payment lifecycles clearly separated.

## Phases
1. **Receipt and download integration** – make receipts accessible via the existing billing receipt helper, keep the transaction reference on `ServiceBookingPayment`, and expose a “Receipt” button in the booking UI.
2. **Provider completes / payer aware workflow** – add the provider “Service Complete” action, surface payer messaging, and display the 3-day countdown.
3. **Complaint/dispute capture & linkage** – build the complaint model, form, and endpoints; link complaints to bookings/payments; introduce complaint statuses.
4. **Admin decision actions** – allow KCNI admins to view complaint data, release payment, or refund the payer with audit logging.
5. **Auto-release scheduler** – schedule a job to release escrow after 3 days when the payer is silent, ensuring idempotency.
6. **Notifications & tests** – notify users throughout the lifecycle and add targeted tests for the critical transitions.

Each phase updates the `docs/service-payment-flow-*.md` files with what was completed, remaining work, and next steps so the repository holds a persistent progress history.
