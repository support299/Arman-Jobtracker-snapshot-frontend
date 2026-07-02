import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const platformApi = createApi({
  reducerPath: 'platformApi',
  baseQuery: axiosBaseQuery({ baseUrl: `${BASE_URL}/platform/` }),
  tagTypes: ['PlatformDashboard', 'PlatformAccount', 'PlatformHealth', 'PlatformAudit', 'PlatformCompany', 'PlatformOnboarding'],
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
  }),
});

export const {
  useGetPlatformDashboardQuery,
  useGetPlatformAccountsQuery,
  useGetPlatformAccountQuery,
  useGetPlatformAccountCalendarsQuery,
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
} = platformApi;
