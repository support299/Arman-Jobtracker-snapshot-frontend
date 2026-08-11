import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const platformApi = createApi({
  reducerPath: 'platformApi',
  baseQuery: axiosBaseQuery({ baseUrl: `${BASE_URL}/platform/` }),
  tagTypes: ['PlatformDashboard', 'PlatformAccount', 'PlatformHealth', 'PlatformAudit', 'PlatformCompany', 'PlatformOnboarding', 'PlatformAgencyOnboarding'],
  endpoints: (builder) => ({
    getPlatformDashboard: builder.query({
      query: () => ({ url: 'dashboard/' }),
      providesTags: ['PlatformDashboard'],
    }),
    getPlatformAccounts: builder.query({
      query: (params = {}) => ({ url: 'accounts/', params }),
      providesTags: (result) =>
        result?.results?.length
          ? [
              ...result.results.map((row) => ({ type: 'PlatformAccount', id: row.id })),
              { type: 'PlatformAccount', id: 'LIST' },
            ]
          : [{ type: 'PlatformAccount', id: 'LIST' }],
    }),
    getPlatformAccount: builder.query({
      query: (id) => ({ url: `accounts/${id}/` }),
      providesTags: (result, error, id) => [{ type: 'PlatformAccount', id }],
    }),
    getPlatformAccountCalendars: builder.query({
      query: (id) => ({ url: `accounts/${id}/calendars/` }),
      providesTags: (result, error, id) => [{ type: 'PlatformAccount', id: `${id}-calendars` }],
    }),
    getPlatformAccountSettings: builder.query({
      query: (id) => ({ url: `accounts/${id}/settings/` }),
      providesTags: (result, error, id) => [{ type: 'PlatformAccount', id: `${id}-settings` }],
    }),
    getPlatformAccountTeam: builder.query({
      query: ({ id, ...params }) => ({ url: `accounts/${id}/team/`, params }),
      providesTags: (result, error, { id }) => [{ type: 'PlatformAccount', id: `${id}-team` }],
    }),
    updatePlatformAccountSettings: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}/settings/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PlatformAccount', id: `${id}-settings` },
        { type: 'PlatformAccount', id },
      ],
    }),
    uploadPlatformAccountLogo: builder.mutation({
      query: ({ id, formData }) => ({
        url: `accounts/${id}/settings/`,
        method: 'PATCH',
        data: formData,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PlatformAccount', id: `${id}-settings` },
        { type: 'PlatformAccount', id },
      ],
    }),
    refreshPlatformAccountCalendars: builder.mutation({
      query: (id) => ({
        url: `accounts/${id}/settings/refresh-calendars/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'PlatformAccount', id: `${id}-settings` },
        { type: 'PlatformAccount', id },
      ],
    }),
    createPlatformTeamMember: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}/team/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'PlatformAccount', id: `${id}-team` }],
    }),
    updatePlatformTeamMember: builder.mutation({
      query: ({ accountId, userId, ...body }) => ({
        url: `accounts/${accountId}/team/${userId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (result, error, { accountId }) => [{ type: 'PlatformAccount', id: `${accountId}-team` }],
    }),
    deletePlatformTeamMember: builder.mutation({
      query: ({ accountId, userId }) => ({
        url: `accounts/${accountId}/team/${userId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { accountId }) => [{ type: 'PlatformAccount', id: `${accountId}-team` }],
    }),
    updatePlatformAccount: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `accounts/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PlatformAccount', id },
        { type: 'PlatformAccount', id: 'LIST' },
        'PlatformDashboard',
        'PlatformHealth',
      ],
    }),
    runPlatformAccountAction: builder.mutation({
      query: ({ id, action }) => ({
        url: `accounts/${id}/actions/`,
        method: 'POST',
        data: { action },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PlatformAccount', id },
        { type: 'PlatformAccount', id: 'LIST' },
        'PlatformHealth',
        'PlatformAudit',
      ],
    }),
    runPlatformHealthCheck: builder.mutation({
      query: (id) => ({
        url: `accounts/${id}/health-check/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'PlatformAccount', id },
        'PlatformHealth',
        'PlatformAudit',
      ],
    }),
    impersonatePlatformAccount: builder.mutation({
      query: ({ id, redirect_path }) => ({
        url: `accounts/${id}/impersonate/`,
        method: 'POST',
        data: redirect_path ? { redirect_path } : {},
      }),
      invalidatesTags: ['PlatformAudit'],
    }),
    getPlatformHealth: builder.query({
      query: (params = {}) => ({ url: 'health/', params }),
      providesTags: ['PlatformHealth'],
    }),
    getPlatformAuditLogs: builder.query({
      query: (params = {}) => ({ url: 'audit/', params }),
      providesTags: ['PlatformAudit'],
    }),
    getPlatformCompanies: builder.query({
      query: (params = {}) => ({ url: 'companies/', params }),
      providesTags: ['PlatformCompany'],
    }),
    getPlatformCompany: builder.query({
      query: (companyId) => ({ url: `companies/${encodeURIComponent(companyId)}/` }),
      providesTags: (result, error, companyId) => [{ type: 'PlatformCompany', id: companyId }],
    }),
    getPlatformOnboardingStatus: builder.query({
      query: () => ({ url: 'onboarding/' }),
      providesTags: ['PlatformOnboarding'],
    }),
    startPlatformOnboarding: builder.mutation({
      query: () => ({
        url: 'onboarding/',
        method: 'POST',
        data: {},
      }),
      invalidatesTags: ['PlatformOnboarding', 'PlatformAudit'],
    }),
    getPlatformAgencyOnboardingStatus: builder.query({
      query: () => ({ url: 'onboarding/agency/' }),
      providesTags: ['PlatformAgencyOnboarding'],
    }),
    startPlatformAgencyOnboarding: builder.mutation({
      query: () => ({
        url: 'onboarding/agency/',
        method: 'POST',
        data: {},
      }),
      invalidatesTags: ['PlatformAgencyOnboarding', 'PlatformOnboarding', 'PlatformCompany', 'PlatformAudit'],
    }),
  }),
});

export const {
  useGetPlatformDashboardQuery,
  useGetPlatformAccountsQuery,
  useGetPlatformAccountQuery,
  useGetPlatformAccountCalendarsQuery,
  useGetPlatformAccountSettingsQuery,
  useGetPlatformAccountTeamQuery,
  useUpdatePlatformAccountSettingsMutation,
  useUploadPlatformAccountLogoMutation,
  useRefreshPlatformAccountCalendarsMutation,
  useCreatePlatformTeamMemberMutation,
  useUpdatePlatformTeamMemberMutation,
  useDeletePlatformTeamMemberMutation,
  useUpdatePlatformAccountMutation,
  useRunPlatformAccountActionMutation,
  useRunPlatformHealthCheckMutation,
  useImpersonatePlatformAccountMutation,
  useGetPlatformHealthQuery,
  useGetPlatformAuditLogsQuery,
  useGetPlatformCompaniesQuery,
  useGetPlatformCompanyQuery,
  useGetPlatformOnboardingStatusQuery,
  useStartPlatformOnboardingMutation,
  useGetPlatformAgencyOnboardingStatusQuery,
  useStartPlatformAgencyOnboardingMutation,
} = platformApi;
