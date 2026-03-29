# Service Payment Flow Progress

## Phase 1 — Receipt integration (2026-03-24)
- **Completed:** Added receipt download capability to the booking detail screen, stored the banking reference on `ServiceBookingPayment`, and wired the receipt API via the existing billing receipt helper.
- **Files changed:**
  - `src/screens/market/ServiceBookingDetailsPage.tsx`
  - `src/network/routes/billingRoutes.ts`
- **Migrations:** N/A
- **Endpoints changed:** None — reuses `/api/v1/billing/wallet/receipt/`
- **Frontend components updated:** Service booking details payment card now shows receipt button and handles receipt downloads safely.
- **Remaining work for this phase:** None — receipt is linked and accessible.
- **Next phase:** Phase 2 (provider completion workflow, payer messaging/countdown).

## Phase 2 — Provider completion workflow (2026-03-24)
- **Completed:** Service booking mark-complete action now triggers a payer notification and we added the payer-facing completion notice + countdown message in the booking details UI. The countdown tracks the satisfaction deadline, so the payer knows how long until auto-release.
- **Files changed:**
  - `apps/commerce/views.py`
  - `src/screens/market/ServiceBookingDetailsPage.tsx`
- **Migrations:** N/A
- **Endpoints changed/added:** existing `service-bookings/{id}/mark-completed` now logs and notifies the payer with the `commerce.service_booking.completed` notification event.
- **Frontend components updated:** booking details page now shows the completion notice/countdown for the payer.
- **Remaining work for this phase:** None. Countdown/message and notification path are in place.
- **Next phase:** Phase 3 (complaint/dispute capture and linkage).
