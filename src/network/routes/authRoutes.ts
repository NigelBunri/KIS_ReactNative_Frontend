import { API_BASE_URL } from '../config';

const authRoutes = {
  auth: {
    login: `${API_BASE_URL}/api/v1/auth/login/`,
    register: `${API_BASE_URL}/api/v1/auth/register/`,
    logout: `${API_BASE_URL}/api/v1/auth/logout/`,
    checkLogin: `${API_BASE_URL}/api/v1/users/me/`,
    otp: `${API_BASE_URL}/api/v1/auth/otp/initiate/`,
    sendDeviceCode: `${API_BASE_URL}/api/v1/auth/otp/verify/`,
    otpChannels: `${API_BASE_URL}/api/v1/auth/otp/channels/`,
    status: `${API_BASE_URL}/api/v1/auth/otp/status/`,
    forgotPassword: `${API_BASE_URL}/api/v1/auth/password/forgot/`,
    resetPassword: `${API_BASE_URL}/api/v1/auth/password/reset/`,
    e2eeRegisterKeys: `${API_BASE_URL}/api/v1/auth/e2ee/keys/`,
    e2eeFetchBundle: (userId: string) => `${API_BASE_URL}/api/v1/auth/e2ee/keys/${userId}/`,
    e2eeFetchDeviceBundles: (userId: string) => `${API_BASE_URL}/api/v1/auth/e2ee/keys/${userId}/devices/`,
    listDevices: `${API_BASE_URL}/api/v1/auth/devices/`,
    revokeDevice: (deviceId: string) => `${API_BASE_URL}/api/v1/auth/devices/${deviceId}/`,
    deviceQRGenerate: `${API_BASE_URL}/api/v1/auth/devices/qr/`,
    deviceQRLogin: `${API_BASE_URL}/api/v1/auth/devices/qr-login/`,
    transferParentDevice: `${API_BASE_URL}/api/v1/auth/devices/transfer-parent/`,
    revokeAllSecondary: `${API_BASE_URL}/api/v1/auth/devices/revoke-all-secondary/`,
    renameDevice: (deviceId: string) => `${API_BASE_URL}/api/v1/auth/devices/${deviceId}/rename/`,
    parentRecoveryInit: `${API_BASE_URL}/api/v1/auth/recovery/initiate/`,
    parentRecoveryConfirm: `${API_BASE_URL}/api/v1/auth/recovery/confirm/`,
    checkContact: `${API_BASE_URL}/api/v1/users/check-contacts/`,
    twoFactorSetup: `${API_BASE_URL}/api/v1/auth/2fa/setup/`,
    twoFactorEnable: `${API_BASE_URL}/api/v1/auth/2fa/enable/`,
    twoFactorDisable: `${API_BASE_URL}/api/v1/auth/2fa/disable/`,
    twoFactorStatus: `${API_BASE_URL}/api/v1/auth/2fa/status/`,
    accountDelete: `${API_BASE_URL}/api/v1/auth/account/`,
    dataExport: `${API_BASE_URL}/api/v1/auth/data-export/`,
    passwordChange: `${API_BASE_URL}/api/v1/auth/password/change/`,
    quicklockPin: `${API_BASE_URL}/api/v1/auth/quicklock-pin/`,
    quicklockPinVerify: `${API_BASE_URL}/api/v1/auth/quicklock-pin/verify/`,
  },
  user: {
    profile: `${API_BASE_URL}/api/v1/users/me/`,
    updateProfile: `${API_BASE_URL}/api/v1/users/me/`,
    preferences: `${API_BASE_URL}/api/v1/profile-privacy/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/users/${id}/`,
    resolveHandle: `${API_BASE_URL}/api/v1/users/resolve-handle/`,
  },
  profiles: {
    me: `${API_BASE_URL}/api/v1/profiles/me/`,
    view: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/view/`,
    update: (id: string) => `${API_BASE_URL}/api/v1/profiles/${id}/`,
    discover: `${API_BASE_URL}/api/v1/profiles/discover/`,
    openToWork: `${API_BASE_URL}/api/v1/profiles/open-to-work/`,
    endorseSkill: (profileId: string) => `${API_BASE_URL}/api/v1/profiles/${profileId}/endorse-skill/`,
  },
  // Direct-to-S3 presigned-PUT upload handshake — see
  // apps/media/upload_intent.py on the backend for the full flow.
  mediaUploads: {
    profileImageInitiate: `${API_BASE_URL}/api/v1/media/uploads/profile-image/initiate/`,
    confirm: (uploadId: string) => `${API_BASE_URL}/api/v1/media/uploads/${uploadId}/confirm/`,
  },
  jobs: {
    board: `${API_BASE_URL}/api/v1/jobs/`,
    myApplications: `${API_BASE_URL}/api/v1/my-applications/`,
  },
  connections: {
    list: `${API_BASE_URL}/api/v1/connections/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/connections/${id}/`,
    peopleYouMayKnow: `${API_BASE_URL}/api/v1/connections/people-you-may-know/`,
  },
  profilePrivacy: {
    list: `${API_BASE_URL}/api/v1/profile-privacy/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-privacy/${id}/`,
  },
  profileArticles: {
    list: `${API_BASE_URL}/api/v1/profile-articles/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-articles/${id}/`,
  },
  profilePreferences: {
    list: `${API_BASE_URL}/api/v1/profile-preferences/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-preferences/${id}/`,
    me: `${API_BASE_URL}/api/v1/profile-preferences/me/`,
    familyAccessibility: `${API_BASE_URL}/api/v1/profile-preferences/family-accessibility/`,
  },
  profileShowcases: {
    list: `${API_BASE_URL}/api/v1/profile-showcases/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-showcases/${id}/`,
  },
  profileLanguages: {
    list: `${API_BASE_URL}/api/v1/profile-languages/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/profile-languages/${id}/`,
    sync: `${API_BASE_URL}/api/v1/profile-languages/sync/`,
  },
  profileItems: {
    experiences: `${API_BASE_URL}/api/v1/experiences/`,
    educations: `${API_BASE_URL}/api/v1/educations/`,
    skills: `${API_BASE_URL}/api/v1/skills/`,
    projects: `${API_BASE_URL}/api/v1/projects/`,
    recommendations: `${API_BASE_URL}/api/v1/recommendations/`,
  },
  subscriptions: {
    list: `${API_BASE_URL}/api/v1/subscriptions/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/subscriptions/${id}/`,
    create: `${API_BASE_URL}/api/v1/subscriptions/`,
  },
  verification: {
    userStatus: `${API_BASE_URL}/api/v1/verification/user/status/`,
    trustOverview: `${API_BASE_URL}/api/v1/verification/trust/overview/`,
    publicTrustSummary: (subjectType: string, subjectId: string) =>
      `${API_BASE_URL}/api/v1/verification/trust/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}/`,
    userStart: `${API_BASE_URL}/api/v1/verification/user/start/`,
    staffCases: `${API_BASE_URL}/api/v1/verification/staff/cases/`,
    staffCase: (caseId: string) => `${API_BASE_URL}/api/v1/verification/staff/cases/${caseId}/`,
    staffBadgeIssue: `${API_BASE_URL}/api/v1/verification/staff/badges/issue/`,
    staffBadgeRevoke: (badgeId: string) => `${API_BASE_URL}/api/v1/verification/staff/badges/${badgeId}/revoke/`,
    staffAuditEvents: `${API_BASE_URL}/api/v1/verification/staff/audit-events/`,
    staffProviderCallbacks: `${API_BASE_URL}/api/v1/verification/staff/provider-callbacks/`,
    staffSuspiciousSignals: `${API_BASE_URL}/api/v1/verification/staff/suspicious-signals/`,
    staffExpiryReminders: `${API_BASE_URL}/api/v1/verification/staff/expiry-reminders/`,
    userEvidence: (caseId: string) => `${API_BASE_URL}/api/v1/verification/user/cases/${caseId}/evidence/`,
    staffUserReview: (caseId: string) => `${API_BASE_URL}/api/v1/verification/staff/user/cases/${caseId}/review/`,
  },
  contacts: {
    check: `${API_BASE_URL}/api/v1/users/check-contacts/`,
  },
  notifications: {
    mention: `${API_BASE_URL}/api/v1/notifications/mention/`,
  },
};

export default authRoutes;
