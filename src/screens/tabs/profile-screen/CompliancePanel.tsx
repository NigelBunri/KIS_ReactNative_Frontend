import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  View,
  Text,
} from 'react-native';
import KISButton from '@/constants/KISButton';
import KISTextInput from '@/constants/KISTextInput';
import type { KISPalette } from '@/theme/constants';
import { styles } from '../profile/profile.styles';
import {
  createComplianceDocument,
  createDataAccessConsent,
  createRegulatoryReport,
  fetchComplianceAuditLogs,
  fetchComplianceDocuments,
  fetchCredentialVerifications,
  fetchDataAccessConsents,
  fetchRegulatoryReports,
  revokeDataAccessConsent,
  signComplianceDocument,
  submitRegulatoryReport,
  verifyCredential,
} from '@/services/complianceService';

const unwrapList = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

type CompliancePanelProps = {
  palette: KISPalette;
  profileId?: string;
  organizationId?: string;
  refreshKey?: string | number;
};

export function CompliancePanel({
  palette,
  profileId,
  organizationId,
  refreshKey,
}: CompliancePanelProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [documentSubmitting, setDocumentSubmitting] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [reportForm, setReportForm] = useState({
    report_type: 'Compliance report',
    profile: profileId || '',
    organization: organizationId || '',
    period_start: '',
    period_end: '',
    data_payload: '',
  });
  const [documentForm, setDocumentForm] = useState({
    document_name: 'Compliance agreement',
    profile: profileId || '',
    organization: organizationId || '',
    file_path: '',
  });
  const [consentForm, setConsentForm] = useState({
    patient: '',
    granted_to: '',
    scope: 'full_access',
    expires_at: '',
  });

  useEffect(() => {
    setReportForm((prev) => ({
      ...prev,
      profile: profileId || prev.profile,
      organization: organizationId || prev.organization,
    }));
    setDocumentForm((prev) => ({
      ...prev,
      profile: profileId || prev.profile,
      organization: organizationId || prev.organization,
    }));
  }, [profileId, organizationId]);

  const loadComplianceData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        auditRes,
        credentialRes,
        reportRes,
        documentRes,
        consentRes,
      ] = await Promise.all([
        fetchComplianceAuditLogs({ ordering: '-created_at', limit: 5 }),
        fetchCredentialVerifications({ ordering: '-expires_at', limit: 5 }),
        fetchRegulatoryReports({ ordering: '-created_at', limit: 5 }),
        fetchComplianceDocuments({ ordering: '-created_at', limit: 5 }),
        fetchDataAccessConsents({ ordering: '-created_at', limit: 5 }),
      ]);

      const errors: string[] = [];

      if (auditRes.success) {
        setAuditLogs(unwrapList(auditRes.data));
      } else {
        errors.push(auditRes.message || 'Unable to load audit logs.');
      }

      if (credentialRes.success) {
        setCredentials(unwrapList(credentialRes.data));
      } else {
        errors.push(credentialRes.message || 'Unable to load credentials.');
      }

      if (reportRes.success) {
        setReports(unwrapList(reportRes.data));
      } else {
        errors.push(reportRes.message || 'Unable to load reports.');
      }

      if (documentRes.success) {
        setDocuments(unwrapList(documentRes.data));
      } else {
        errors.push(documentRes.message || 'Unable to load documents.');
      }

      if (consentRes.success) {
        setConsents(unwrapList(consentRes.data));
      } else {
        errors.push(consentRes.message || 'Unable to load consents.');
      }

      if (errors.length) {
        Alert.alert('Compliance', errors.join('\n'));
      }
    } catch (error: any) {
      Alert.alert('Compliance', error?.message || 'Unable to load compliance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComplianceData();
  }, [loadComplianceData, refreshKey]);

  const handleRefresh = useCallback(() => {
    void loadComplianceData();
  }, [loadComplianceData]);

  const handleVerifyCredential = useCallback(
    async (id: string) => {
      setVerifyingId(id);
      try {
        const res = await verifyCredential(id);
        if (!res?.success) throw new Error(res?.message || 'Unable to verify credential.');
        Alert.alert('Compliance', 'Credential marked verified.');
        await loadComplianceData();
      } catch (error: any) {
        Alert.alert('Compliance', error?.message || 'Unable to verify credential.');
      } finally {
        setVerifyingId(null);
      }
    },
    [loadComplianceData],
  );

  const handleSubmitReport = useCallback(
    async (id: string) => {
      setReportSubmitting(true);
      try {
        const res = await submitRegulatoryReport(id);
        if (!res?.success) throw new Error(res?.message || 'Unable to submit report.');
        Alert.alert('Compliance', 'Report submitted for review.');
        await loadComplianceData();
      } catch (error: any) {
        Alert.alert('Compliance', error?.message || 'Unable to submit report.');
      } finally {
        setReportSubmitting(false);
      }
    },
    [loadComplianceData],
  );

  const handleCreateReport = useCallback(async () => {
    if (!reportForm.profile || !reportForm.organization || !reportForm.period_start || !reportForm.period_end) {
      Alert.alert('Compliance', 'Provide profile, organization, and period dates for the report.');
      return;
    }
    setReportSubmitting(true);
    try {
      const parsedPayload = reportForm.data_payload ? JSON.parse(reportForm.data_payload) : {};
      const res = await createRegulatoryReport({
        report_type: reportForm.report_type,
        profile: reportForm.profile,
        organization: reportForm.organization,
        period_start: reportForm.period_start,
        period_end: reportForm.period_end,
        data_payload: parsedPayload,
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to create regulatory report.');
      Alert.alert('Compliance', 'Regulatory report created.');
      setReportForm((prev) => ({ ...prev, period_start: '', period_end: '', data_payload: '' }));
      await loadComplianceData();
    } catch (error: any) {
      Alert.alert('Compliance', error?.message || 'Unable to create regulatory report.');
    } finally {
      setReportSubmitting(false);
    }
  }, [loadComplianceData, reportForm]);

  const handleSignDocument = useCallback(
    async (id: string) => {
      setSigningId(id);
      try {
        const res = await signComplianceDocument(id);
        if (!res?.success) throw new Error(res?.message || 'Unable to sign document.');
        Alert.alert('Compliance', 'Document signed.');
        await loadComplianceData();
      } catch (error: any) {
        Alert.alert('Compliance', error?.message || 'Unable to sign document.');
      } finally {
        setSigningId(null);
      }
    },
    [loadComplianceData],
  );

  const handleCreateDocument = useCallback(async () => {
    if (!documentForm.document_name || !documentForm.file_path) {
      Alert.alert('Compliance', 'Provide a document name and file path (device URI).');
      return;
    }
    setDocumentSubmitting(true);
    try {
      const res = await createComplianceDocument({
        document_name: documentForm.document_name,
        profile: documentForm.profile,
        organization: documentForm.organization,
        file_path: documentForm.file_path,
        status: 'draft',
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to upload document.');
      Alert.alert('Compliance', 'Document recorded.');
      setDocumentForm((prev) => ({
        ...prev,
        document_name: 'Compliance agreement',
        file_path: '',
      }));
      await loadComplianceData();
    } catch (error: any) {
      Alert.alert('Compliance', error?.message || 'Unable to upload document.');
    } finally {
      setDocumentSubmitting(false);
    }
  }, [documentForm, loadComplianceData]);

  const handleCreateConsent = useCallback(async () => {
    if (!consentForm.patient || !consentForm.granted_to) {
      Alert.alert('Compliance', 'Provide patient and granted-to details.');
      return;
    }
    setConsentSubmitting(true);
    try {
      const res = await createDataAccessConsent({
        patient: consentForm.patient,
        granted_to: consentForm.granted_to,
        scope: consentForm.scope,
        expires_at: consentForm.expires_at || null,
      });
      if (!res?.success) throw new Error(res?.message || 'Unable to create consent.');
      Alert.alert('Compliance', 'Data access consent saved.');
      setConsentForm((prev) => ({ ...prev, patient: '', granted_to: '', scope: prev.scope, expires_at: '' }));
      await loadComplianceData();
    } catch (error: any) {
      Alert.alert('Compliance', error?.message || 'Unable to create consent.');
    } finally {
      setConsentSubmitting(false);
    }
  }, [consentForm, loadComplianceData]);

  const handleRevokeConsent = useCallback(
    async (id: string) => {
      setRevokingId(id);
      try {
        const res = await revokeDataAccessConsent(id);
        if (!res?.success) throw new Error(res?.message || 'Unable to revoke consent.');
        Alert.alert('Compliance', 'Consent revoked.');
        await loadComplianceData();
      } catch (error: any) {
        Alert.alert('Compliance', error?.message || 'Unable to revoke consent.');
      } finally {
        setRevokingId(null);
      }
    },
    [loadComplianceData],
  );

  const sectionStyle = useMemo(
    () => ({
      borderWidth: 2,
      borderColor: palette.divider,
      borderRadius: 14,
      padding: 12,
      backgroundColor: palette.card,
      marginTop: 10,
      gap: 8,
    }),
    [palette.card, palette.divider],
  );

  const renderAuditItem = (item: any, index: number) => (
    <View key={item.id ?? index} style={styles.managementItemCard}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>{item.action}</Text>
      <Text style={{ color: palette.subtext }}>Severity: {item.severity}</Text>
      <Text style={{ color: palette.subtext }}>{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );

  const renderCredential = (item: any) => (
    <View
      key={item.id}
      style={[styles.managementItemCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
    >
      <View>
        <Text style={{ color: palette.text, fontWeight: '700' }}>{item.credential_type}</Text>
        <Text style={{ color: palette.subtext }}>{item.status}</Text>
        {item.license_number ? (
          <Text style={{ color: palette.subtext }}>License: {item.license_number}</Text>
        ) : null}
      </View>
      <KISButton
        title={item.status === 'verified' ? 'Verified' : 'Verify'}
        variant={item.status === 'verified' ? 'ghost' : 'outline'}
        size="xs"
        onPress={() => handleVerifyCredential(item.id)}
        disabled={item.status === 'verified' || verifyingId === item.id}
        right={
          verifyingId === item.id ? (
            <ActivityIndicator size="small" color={palette.primaryStrong} />
          ) : undefined
        }
      />
    </View>
  );

  const renderReport = (item: any) => (
    <View key={item.id} style={styles.managementItemCard}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>{item.report_type}</Text>
      <Text style={{ color: palette.subtext }}>{item.status}</Text>
      <Text style={{ color: palette.subtext }}>
        {item.period_start} → {item.period_end}
      </Text>
      {item.status === 'draft' ? (
        <KISButton
          title="Submit"
          variant="outline"
          size="xs"
          onPress={() => handleSubmitReport(item.id)}
          disabled={reportSubmitting}
          right={
            reportSubmitting ? (
              <ActivityIndicator size="small" color={palette.primaryStrong} />
            ) : undefined
          }
        />
      ) : null}
    </View>
  );

  const renderDocument = (item: any) => (
    <View key={item.id} style={styles.managementItemCard}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>{item.document_name}</Text>
      <Text style={{ color: palette.subtext }}>{item.status}</Text>
      {item.is_signed && item.signed_at ? (
        <Text style={{ color: palette.subtext }}>Signed at {new Date(item.signed_at).toLocaleString()}</Text>
      ) : (
        <KISButton
          title="Sign"
          variant="outline"
          size="xs"
          onPress={() => handleSignDocument(item.id)}
          disabled={signingId === item.id}
          right={
            signingId === item.id ? (
              <ActivityIndicator size="small" color={palette.primaryStrong} />
            ) : undefined
          }
        />
      )}
    </View>
  );

  const renderConsent = (item: any) => (
    <View key={item.id} style={styles.managementItemCard}>
      <Text style={{ color: palette.text, fontWeight: '700' }}>{item.patient}</Text>
      <Text style={{ color: palette.subtext }}>Granted to {item.granted_to}</Text>
      <Text style={{ color: palette.subtext }}>Status: {item.status}</Text>
      <KISButton
        title="Revoke"
        variant="outline"
        size="xs"
        onPress={() => handleRevokeConsent(item.id)}
        disabled={revokingId === item.id || item.status !== 'active'}
        right={
          revokingId === item.id ? (
            <ActivityIndicator size="small" color={palette.primaryStrong} />
          ) : undefined
        }
      />
    </View>
  );

  return (
    <View style={styles.managementForm}>
      <View style={sectionStyle}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '700' }}>Compliance snapshot</Text>
          <KISButton
            title="Refresh"
            variant="ghost"
            size="xs"
            onPress={handleRefresh}
            disabled={loading}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={palette.primaryStrong} />
        ) : null}
        <Text style={{ color: palette.subtext }}>Audit, credentials, reports, documents, and consents.</Text>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Audit log</Text>
        {auditLogs.length ? auditLogs.map(renderAuditItem) : <Text style={{ color: palette.subtext }}>No entries yet.</Text>}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Credentials</Text>
        {credentials.length ? credentials.map(renderCredential) : <Text style={{ color: palette.subtext }}>No credentials.</Text>}
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Regulatory reports</Text>
        {reports.length ? reports.map(renderReport) : <Text style={{ color: palette.subtext }}>No reports.</Text>}
        <View style={styles.managementForm}>
          <KISTextInput
            label="Report type"
            value={reportForm.report_type}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, report_type: value }))}
          />
          <KISTextInput
            label="Profile ID"
            value={reportForm.profile}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, profile: value }))}
          />
          <KISTextInput
            label="Organization ID"
            value={reportForm.organization}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, organization: value }))}
          />
          <KISTextInput
            label="Period start"
            value={reportForm.period_start}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, period_start: value }))}
          />
          <KISTextInput
            label="Period end"
            value={reportForm.period_end}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, period_end: value }))}
          />
          <KISTextInput
            label="Payload (JSON)"
            value={reportForm.data_payload}
            onChangeText={(value) => setReportForm((prev) => ({ ...prev, data_payload: value }))}
            multiline
            layout={{ multilineMinHeight: 80 }}
            placeholder='{"summary": "Key metrics"}'
          />
          <KISButton
            title="Create report"
            onPress={handleCreateReport}
            disabled={reportSubmitting}
            right={
              reportSubmitting ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : undefined
            }
          />
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Documents</Text>
        {documents.length ? documents.map(renderDocument) : <Text style={{ color: palette.subtext }}>No documents recorded.</Text>}
        <View style={styles.managementForm}>
          <KISTextInput
            label="Document name"
            value={documentForm.document_name}
            onChangeText={(value) => setDocumentForm((prev) => ({ ...prev, document_name: value }))}
          />
          <KISTextInput
            label="Profile ID"
            value={documentForm.profile}
            onChangeText={(value) => setDocumentForm((prev) => ({ ...prev, profile: value }))}
          />
          <KISTextInput
            label="Organization ID"
            value={documentForm.organization}
            onChangeText={(value) => setDocumentForm((prev) => ({ ...prev, organization: value }))}
          />
          <KISTextInput
            label="File path (device URI)"
            value={documentForm.file_path}
            onChangeText={(value) => setDocumentForm((prev) => ({ ...prev, file_path: value }))}
          />
          <KISButton
            title="Record document"
            onPress={handleCreateDocument}
            disabled={documentSubmitting}
            right={
              documentSubmitting ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : undefined
            }
          />
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>Data access consents</Text>
        {consents.length ? consents.map(renderConsent) : <Text style={{ color: palette.subtext }}>No consents.</Text>}
        <View style={styles.managementForm}>
          <KISTextInput
            label="Patient ID"
            value={consentForm.patient}
            onChangeText={(value) => setConsentForm((prev) => ({ ...prev, patient: value }))}
          />
          <KISTextInput
            label="Granted to"
            value={consentForm.granted_to}
            onChangeText={(value) => setConsentForm((prev) => ({ ...prev, granted_to: value }))}
          />
          <KISTextInput
            label="Scope"
            value={consentForm.scope}
            onChangeText={(value) => setConsentForm((prev) => ({ ...prev, scope: value }))}
          />
          <KISTextInput
            label="Expires at"
            value={consentForm.expires_at}
            onChangeText={(value) => setConsentForm((prev) => ({ ...prev, expires_at: value }))}
          />
          <KISButton
            title="Create consent"
            variant="secondary"
            onPress={handleCreateConsent}
            disabled={consentSubmitting}
            right={
              consentSubmitting ? <ActivityIndicator size="small" color={palette.primaryStrong} /> : undefined
            }
          />
        </View>
      </View>
    </View>
  );
}
