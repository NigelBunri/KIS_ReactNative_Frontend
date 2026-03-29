import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import ROUTES from '@/network';

export const fetchComplianceAuditLogs = (params?: Record<string, any>) =>
  getRequest(ROUTES.compliance.auditLogs, {
    params,
    errorMessage: 'Unable to load compliance audit logs.',
  });

export const fetchCredentialVerifications = (params?: Record<string, any>) =>
  getRequest(ROUTES.compliance.credentials, {
    params,
    errorMessage: 'Unable to load credentials.',
  });

export const verifyCredential = (credentialId: string) =>
  postRequest(ROUTES.compliance.credential(credentialId), {}, {
    errorMessage: 'Unable to verify credential.',
  });

export const fetchRegulatoryReports = (params?: Record<string, any>) =>
  getRequest(ROUTES.compliance.regulatoryReports, {
    params,
    errorMessage: 'Unable to load regulatory reports.',
  });

export const createRegulatoryReport = (payload: Record<string, any>) =>
  postRequest(ROUTES.compliance.regulatoryReports, payload, {
    errorMessage: 'Unable to create regulatory report.',
  });

export const submitRegulatoryReport = (reportId: string) =>
  postRequest(ROUTES.compliance.submitReport(reportId), {}, {
    errorMessage: 'Unable to submit report.',
  });

export const fetchComplianceDocuments = (params?: Record<string, any>) =>
  getRequest(ROUTES.compliance.documents, {
    params,
    errorMessage: 'Unable to load compliance documents.',
  });

export const createComplianceDocument = (payload: Record<string, any>) =>
  postRequest(ROUTES.compliance.documents, payload, {
    errorMessage: 'Unable to upload compliance document.',
  });

export const signComplianceDocument = (documentId: string) =>
  postRequest(ROUTES.compliance.signDocument(documentId), {}, {
    errorMessage: 'Unable to sign document.',
  });

export const fetchDataAccessConsents = (params?: Record<string, any>) =>
  getRequest(ROUTES.compliance.dataAccess, {
    params,
    errorMessage: 'Unable to load data access consents.',
  });

export const createDataAccessConsent = (payload: Record<string, any>) =>
  postRequest(ROUTES.compliance.dataAccess, payload, {
    errorMessage: 'Unable to create data access consent.',
  });

export const revokeDataAccessConsent = (consentId: string) =>
  postRequest(ROUTES.compliance.revokeConsent(consentId), {}, {
    errorMessage: 'Unable to revoke consent.',
  });
