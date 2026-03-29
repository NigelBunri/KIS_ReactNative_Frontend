import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import billingRoutes from '@/network/routes/billingRoutes';

export const fetchBillingReconciliations = (params?: Record<string, any>) =>
  getRequest(billingRoutes.reconciliations, {
    params,
    errorMessage: 'Unable to load reconciliation batches.',
  });

export const createBillingReconciliation = (payload: Record<string, any>) =>
  postRequest(billingRoutes.reconciliations, payload, {
    errorMessage: 'Unable to record reconciliation.',
  });

export const reconcileBillingEntry = (id: string) =>
  postRequest(billingRoutes.reconcile(id), {}, {
    errorMessage: 'Unable to reconcile entry.',
  });

export const fetchInsuranceClaims = (params?: Record<string, any>) =>
  getRequest(billingRoutes.claims, {
    params,
    errorMessage: 'Unable to load claims.',
  });

export const createInsuranceClaim = (payload: Record<string, any>) =>
  postRequest(billingRoutes.claims, payload, {
    errorMessage: 'Unable to submit claim.',
  });

export const updateInsuranceClaimStatus = (id: string, payload: Record<string, any>) =>
  postRequest(billingRoutes.claimStatus(id), payload, {
    errorMessage: 'Unable to update claim status.',
  });

export const fetchPaymentDisputes = (params?: Record<string, any>) =>
  getRequest(billingRoutes.disputes, {
    params,
    errorMessage: 'Unable to load disputes.',
  });

export const createPaymentDispute = (payload: Record<string, any>) =>
  postRequest(billingRoutes.disputes, payload, {
    errorMessage: 'Unable to file dispute.',
  });

export const resolvePaymentDispute = (id: string, payload?: Record<string, any>) =>
  postRequest(billingRoutes.disputeResolve(id), payload ?? {}, {
    errorMessage: 'Unable to resolve dispute.',
  });

export const fetchPricingInsights = () =>
  getRequest(billingRoutes.pricingInsights, {
    errorMessage: 'Unable to load pricing insights.',
  });
