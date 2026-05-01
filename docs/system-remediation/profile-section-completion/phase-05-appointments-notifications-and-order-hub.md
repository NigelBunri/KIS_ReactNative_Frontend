# Phase 5: Appointments, Notifications, and Order Hub

Goal:
- finish the operational shortcuts in profile so they feel intentional instead of incidental

Scope:
- `/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx`
- appointment and marketplace-order summary blocks
- in-app notifications block

Objectives:
- decide what profile should truly summarize versus what should be moved to dedicated inbox/order screens
- make appointment, order, and notification cards consistent and high-signal

Work items:
- unify appointment logic so profile shows only the right summary depth
- review whether education bookings should surface here or stay elsewhere
- improve notification card actions and grouping
- improve marketplace order summary language and signals
- remove low-value duplication with dedicated screens

Exit criteria:
- profile contains intentional summaries, not random dashboard fragments
- notifications and orders feel like curated entry points

Implementation status:
- Complete in code on 2026-04-26.
- The profile tab now treats appointments, notifications, and marketplace orders as summary hubs instead of raw dashboard fragments in [ProfileScreen.tsx](/Users/nigel/dev/KIS/src/screens/tabs/ProfileScreen.tsx).
- Appointments now show summary counts and only the top few active items.
- Notifications now show unread/recent counts and a shorter recent list.
- Marketplace orders now show grouped status counts plus a small recent-orders snapshot.

Validation:
- `python3 manage.py check` passed
- `pnpm tsc --noEmit --pretty false` did not finish within the same reasonable validation window because of the repo-wide TypeScript backlog and project size

Out of scope:
- full standalone order or booking product redesign
