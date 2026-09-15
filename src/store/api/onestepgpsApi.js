import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const onestepgpsApi = createApi({
  reducerPath: 'onestepgpsApi',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL + '/onestepgps/' }),
  tagTypes: ['OneStepGPSSettings', 'OneStepGPSAlerts', 'FleetTrips', 'FleetMaintenance', 'FleetGeofences', 'FleetAssignments', 'FleetReports'],
  endpoints: (builder) => ({
    getSettings: builder.query({
      query: () => ({ url: 'settings/' }),
      providesTags: ['OneStepGPSSettings'],
    }),
    updateSettings: builder.mutation({
      query: (data) => ({
        url: 'settings/',
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['OneStepGPSSettings'],
    }),
    testConnection: builder.mutation({
      query: (data = {}) => ({
        url: 'settings/test/',
        method: 'POST',
        data,
      }),
    }),
    getDevices: builder.query({
      query: () => ({ url: 'devices/' }),
      keepUnusedDataFor: 10,
    }),
    getRecentAlerts: builder.query({
      query: (params = {}) => ({ url: 'alerts/recent/', params }),
      providesTags: ['OneStepGPSAlerts'],
      keepUnusedDataFor: 15,
    }),
    getAlertCounts: builder.query({
      query: (params = {}) => ({ url: 'alerts/counts/', params }),
      providesTags: ['OneStepGPSAlerts'],
      keepUnusedDataFor: 15,
    }),
    acknowledgeAlert: builder.mutation({
      query: (id) => ({
        url: `alerts/${id}/acknowledge/`,
        method: 'POST',
      }),
      invalidatesTags: ['OneStepGPSAlerts'],
    }),
    getFleetSummary: builder.query({
      query: () => ({ url: 'fleet/summary/' }),
    }),
    getFleetTrips: builder.query({
      query: (params = {}) => ({ url: 'fleet/trips/', params }),
      providesTags: ['FleetTrips'],
    }),
    getFleetMaintenance: builder.query({
      query: () => ({ url: 'fleet/maintenance/' }),
      providesTags: ['FleetMaintenance'],
    }),
    ensureFleetMaintenance: builder.mutation({
      query: (data) => ({ url: 'fleet/maintenance/', method: 'POST', data }),
      invalidatesTags: ['FleetMaintenance'],
    }),
    updateFleetMaintenance: builder.mutation({
      query: ({ id, ...data }) => ({ url: `fleet/maintenance/${id}/`, method: 'PATCH', data }),
      invalidatesTags: ['FleetMaintenance'],
    }),
    completeFleetMaintenance: builder.mutation({
      query: ({ id, ...data }) => ({ url: `fleet/maintenance/${id}/complete/`, method: 'POST', data }),
      invalidatesTags: ['FleetMaintenance'],
    }),
    getFleetGeofences: builder.query({
      query: () => ({ url: 'fleet/geofences/' }),
      providesTags: ['FleetGeofences'],
    }),
    createFleetGeofence: builder.mutation({
      query: (data) => ({ url: 'fleet/geofences/', method: 'POST', data }),
      invalidatesTags: ['FleetGeofences'],
    }),
    updateFleetGeofence: builder.mutation({
      query: ({ id, ...data }) => ({ url: `fleet/geofences/${id}/`, method: 'PATCH', data }),
      invalidatesTags: ['FleetGeofences'],
    }),
    deleteFleetGeofence: builder.mutation({
      query: (id) => ({ url: `fleet/geofences/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['FleetGeofences'],
    }),
    getFleetAssignments: builder.query({
      query: () => ({ url: 'fleet/assignments/' }),
      providesTags: ['FleetAssignments'],
    }),
    saveFleetAssignments: builder.mutation({
      query: (assignments) => ({
        url: 'fleet/assignments/',
        method: 'PUT',
        data: { assignments },
      }),
      invalidatesTags: ['FleetAssignments'],
    }),
    getFleetReports: builder.query({
      query: () => ({ url: 'fleet/reports/' }),
      providesTags: ['FleetReports'],
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useTestConnectionMutation,
  useGetDevicesQuery,
  useGetRecentAlertsQuery,
  useGetAlertCountsQuery,
  useAcknowledgeAlertMutation,
  useGetFleetSummaryQuery,
  useGetFleetTripsQuery,
  useGetFleetMaintenanceQuery,
  useEnsureFleetMaintenanceMutation,
  useUpdateFleetMaintenanceMutation,
  useCompleteFleetMaintenanceMutation,
  useGetFleetGeofencesQuery,
  useCreateFleetGeofenceMutation,
  useUpdateFleetGeofenceMutation,
  useDeleteFleetGeofenceMutation,
  useGetFleetAssignmentsQuery,
  useSaveFleetAssignmentsMutation,
  useGetFleetReportsQuery,
} = onestepgpsApi;
