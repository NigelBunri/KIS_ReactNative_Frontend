# Service Payment Flow Decisions

- **Receipt generation:** We reuse the existing `build_receipt_urls` helper under `apps.billing.documents` and the `/api/v1/billing/wallet/receipt/` endpoint rather than inventing a new receipt template, ensuring consistency with the Upgrade Account/Billing History design.
- **Receipt linkage:** `ServiceBookingPayment.transaction_reference` stores the wallet transaction `tx_ref`, guaranteeing receipt lookup even after refresh.
- **Receipt access:** The frontend uses `ROUTES.billing.walletReceipt` to fetch the receipt URLs on demand and opens the returned PDF/HTML via the native share sheet.
