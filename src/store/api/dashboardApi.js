import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL + '/dashboard/' }),
  tagTypes: ['Dashboard', 'DashboardContact'],
  endpoints: (builder) => ({
    getAnalytics: builder.query({
      query: (params = {}) => ({ url: 'invoices/analytics/', params }),
      providesTags: ['Dashboard'],
    }),
    getHeatMap: builder.query({
      query: (params = {}) => ({ url: 'technician-workload/', params }),
      providesTags: ['Dashboard'],
    }),
    getSalesForecasting: builder.query({
      query: (params = {}) => ({ url: 'invoices/sales_forecasting/', params }),
      providesTags: ['Dashboard'],
    }),
    getLeadFunnelReport: builder.query({
      query: (params = {}) => ({ url: 'invoices/lead_funnel_report/', params }),
      providesTags: ['Dashboard'],
    }),
    /** Paginated CRM contacts. Params: page, page_size, search, location_id, ordering, tax_exempt, dnd, has_email, has_phone, has_company, date_added_after, date_added_before, has_jobs, has_pending_jobs, has_quotes, has_invoices, has_addresses */
    getDashboardContacts: builder.query({
      query: (params = {}) => ({ url: 'contacts/', params }),
      providesTags: (result) =>
        result?.results?.length
          ? [
              ...result.results.map((row) => ({
                type: 'DashboardContact',
                id: String(row.ghl_contact_id || row.contact_id || row.id),
              })),
              { type: 'DashboardContact', id: 'LIST' },
            ]
          : [{ type: 'DashboardContact', id: 'LIST' }],
    }),
    /** Full contact graph: addresses, submissions, jobs, invoices, appointments, summary */
    getDashboardContactById: builder.query({
      query: (id) => ({
        url: `contacts/${encodeURIComponent(String(id))}/`,
      }),
      providesTags: (result, error, id) => [{ type: 'DashboardContact', id: String(id) }],
    }),
    updateDashboardContact: builder.mutation({
      query: ({ ghlContactId, lookupId: _lookupId, ...data }) => ({
        url: `contacts/${encodeURIComponent(String(ghlContactId))}/`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: (result, error, { ghlContactId, lookupId }) => [
        { type: 'DashboardContact', id: String(ghlContactId) },
        ...(lookupId != null && String(lookupId) !== String(ghlContactId)
          ? [{ type: 'DashboardContact', id: String(lookupId) }]
          : []),
        { type: 'DashboardContact', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetAnalyticsQuery,
  useGetHeatMapQuery,
  useGetSalesForecastingQuery,
  useGetLeadFunnelReportQuery,
  useGetDashboardContactsQuery,
  useGetDashboardContactByIdQuery,
  useUpdateDashboardContactMutation,
} = dashboardApi;


