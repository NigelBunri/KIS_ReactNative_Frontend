# KIS Engineering Sweep

This is the long-form hardening program for the React Native app and Django backend (Nest messaging backend excluded for now).

## Goal
- Move the codebase to a repeatable, security-focused, testable architecture.
- Eliminate junk/dead code iteratively.
- Keep each phase checkpointed so work can continue safely across sessions/model changes.

## Phase Plan

## Phase 01: Baseline and Guardrails
- Create repeatable audit script and artifacts.
- Capture current quality/security/test baseline for both stacks.
- Remove obvious low-risk junk in touched areas.
- Output: baseline report + saved artifacts.

## Phase 02: Critical Security Hardening
- Status: Completed (`2026-03-07`)
- Django deploy-grade security settings and secret handling.
- API auth/schema hardening (permissions, serializer definitions, unsafe endpoints).
- React Native secret/token and transport hardening.
- Output: security delta report + verification commands.

## Phase 03: Backend Architecture and Data Integrity
- Status: Completed (`2026-03-07`)
- Clean module boundaries and service layer consistency.
- Resolve broken model relations/migrations blocking tests.
- Remove temporary fallback patterns where APIs now exist.
- Output: green targeted backend test suite for critical domains.

## Phase 04: Frontend Architecture and Cleanup
- Status: Completed (`2026-03-07`)
- Normalize screen/controller/service boundaries.
- Remove dead exports, unused paths, and debug leftovers.
- Reduce lint errors to agreed threshold and enforce gates.
- Output: typecheck + lint standards documented and enforced.

## Phase 05: End-to-End Tier/Billing/Profile Reliability
- Status: Completed (`2026-03-07`)
- Tier enforcement flow tests (upgrade/downgrade/limits).
- Billing/wallet transfer safety checks and negative-path tests.
- Profile editor and phone/login consistency end-to-end validation.
- Output: pass/fail matrix for core production flows.

## Phase 06: Release Readiness
- Status: Completed (`2026-03-07`)
- CI-style quality gate script for both stacks.
- Regression checklist and operational runbook.
- Residual risk register with explicit follow-ups.
- Output: release readiness report.
