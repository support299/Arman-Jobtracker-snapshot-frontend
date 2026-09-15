import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL, axiosInstance } from '../axios/axios';

export const jobsApi = createApi({
  reducerPath: 'jobsApi',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL + '/job/' }),
  tagTypes: ['Job', 'Assignment', 'Schedule', 'Appointment', 'Estimate'],
  endpoints: (builder) => ({
    getJobs: builder.query({
      query: (params = {}) => ({ url: 'jobs/', params }),
      providesTags: ['Job'],
    }),
    getJobById: builder.query({
      query: (id) => ({ url: `${id}/` }),
      providesTags: (r, e, id) => [{ type: 'Job', id }],
    }),
    createJob: builder.mutation({
      query: ({apiEndpoint, payload}) => ({ url: `${apiEndpoint}/`, method: 'POST', data: payload }),
      invalidatesTags: ['Job'],
    }),
    updateJob: builder.mutation({
      query: ({ id, filter, ...payload }) => ({
        url: filter ? `jobs/${id}/?${filter}` : `jobs/${id}/`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),
    convertJobToSeries: builder.mutation({
      query: ({ id, payload }) => ({
        url: `jobs/${id}/convert-to-series/`,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['Job'],
    }),
    getJobsByLocation: builder.query({
      query: (params) => ({ url: 'locations/jobs/', method: 'GET', params}),
    }),
    getLocations: builder.query({
      query: (params) => ({ url: 'locations/', method: 'GET', params}),
      providesTags: ['Job'],
    }),
    deleteJob: builder.mutation({
      query: (id) => ({ url: `jobs/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['Job'],
    }),
    deleteJobSeries: builder.mutation({
      query: (seriesId) => ({ url: `jobs-series/${seriesId}/`, method: 'DELETE' }),
      invalidatesTags: ['Job'],
    }),

    //Calendar jobs - uses occurrences endpoint for flattened calendar events
    getCalendarJobs: builder.query({
      query: (params = {}) => {
        // Build query params for occurrences API
        const queryParams = {};
        if (params.start) queryParams.start = params.start;
        if (params.end) queryParams.end = params.end;
        if (params.status) queryParams.status = params.status;
        if (params.job_ids) queryParams.job_ids = params.job_ids;
        if (params.job_type) queryParams.job_type = params.job_type;
        if (params.assignee_ids) queryParams.assignee_ids = params.assignee_ids;
        if (params.search) queryParams.search = params.search;
        if (params.scope) queryParams.scope = params.scope;
        if (params.unassigned === true || params.unassigned === 'true') queryParams.unassigned = true;
        return { url: 'occurrences/', params: queryParams };
      },
      providesTags: ['Job'],
    }),

    // Get full job details by job_id (used when clicking on calendar event)
    getJobDetails: builder.query({
      query: (jobId) => ({ url: `jobs/${jobId}/` }),
      providesTags: (r, e, jobId) => [{ type: 'Job', id: jobId }],
    }),

    /** Public job detail (portal / unauthenticated-safe); GET …/job/public/jobs/{job_id}/ */
    getPublicJobDetails: builder.query({
      query: (jobId) => ({ url: `public/jobs/${jobId}/` }),
      providesTags: (r, e, jobId) => [{ type: 'Job', id: `public:${jobId}` }],
    }),

    // Appointments
    getAppointmentsCalendar: builder.query({
      query: (params = {}) => {
        // Build query params for appointments API
        const queryParams = {};
        if (params.start) queryParams.start = params.start;
        if (params.end) queryParams.end = params.end;
        if (params.status) queryParams.status = params.status;
        if (params.assigned_user_ids) queryParams.assigned_user_ids = params.assigned_user_ids;
        if (params.search) queryParams.search = params.search;
        if (params.unassigned === true || params.unassigned === 'true') queryParams.unassigned = true;
        return { url: 'appointments-calendar/', params: queryParams };
      },
      providesTags: ['Appointment'],
    }),
    createAppointment: builder.mutation({
      query: (payload) => ({ url: 'appointments/', method: 'POST', data: payload }),
      invalidatesTags: ['Appointment'],
    }),
    updateAppointment: builder.mutation({
      query: ({ id, ...payload }) => ({ url: `appointments/${id}/`, method: 'PATCH', data: payload }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Appointment', id }],
    }),
    deleteAppointment: builder.mutation({
      query: (id) => ({ url: `appointments/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['Appointment'],
    }),

    // Estimates
    getEstimateAppointmentsCalendar: builder.query({
      query: (params = {}) => {
        // Build query params for estimates API
        const queryParams = {};
        if (params.start) queryParams.start = params.start;
        if (params.end) queryParams.end = params.end;
        if (params.status) queryParams.status = params.status;
        if (params.assigned_user_ids) queryParams.assigned_user_ids = params.assigned_user_ids;
        if (params.search) queryParams.search = params.search;
        return { url: 'estimate-appointments/', params: queryParams };
      },
      providesTags: ['Estimate'],
    }),
    updateEstimateStatus: builder.mutation({
      query: ({ id, estimate_status }) => ({ 
        url: `estimate-appointments/${id}/update-status/`, 
        method: 'PATCH', 
        data: { estimate_status },
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Estimate', id }],
    }),
    deleteEstimate: builder.mutation({
      query: (id) => ({ url: `appointments/${id}/`, method: 'DELETE' }),
      invalidatesTags: ['Estimate'],
    }),

    // Job Images - uses different base URL (/api/jobtracker/ instead of /api/job/)
    uploadJobImage: builder.mutation({
      queryFn: async (formData) => {
        try {
          const result = await axiosInstance({
            url: '/job/job-images/',
            method: 'POST',
            data: formData,
          });
          return { data: result.data };
        } catch (error) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
      invalidatesTags: ['Job'],
    }),

    // Delete Job Image
    deleteJobImage: builder.mutation({
      queryFn: async (imageId) => {
        try {
          const result = await axiosInstance({
            url: `/job/job-images/${imageId}/`,
            method: 'DELETE',
          });
          return { data: result.data };
        } catch (error) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
      invalidatesTags: ['Job'],
    }),

    // Update Payment Method
    updateJobPaymentMethod: builder.mutation({
      query: ({ id, payment_method }) => ({ 
        url: `jobs/${id}/update-payment-method/`, 
        method: 'PATCH', 
        data: { payment_method },
      }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Job', id }],
    }),

    // Search Contacts (for admin job creation) - uses quote API
    searchContacts: builder.query({
      queryFn: async (searchTerm) => {
        try {
          const result = await axiosInstance({
            url: `/quote/contacts/search/?search=${searchTerm}`,
            method: 'GET',
          });
          return { data: result.data };
        } catch (error) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
    }),

    getSubaccountOffice: builder.query({
      queryFn: async () => {
        try {
          const result = await axiosInstance({
            url: '/accounts/subaccount-office/',
            method: 'GET',
          });
          return { data: result.data };
        } catch (error) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
      keepUnusedDataFor: 300,
    }),

    // Get Addresses by Contact (for admin job creation) - uses quote API
    getAddressesByContact: builder.query({
      queryFn: async (contactId) => {
        try {
          const result = await axiosInstance({
            url: `/quote/address/by-contact/${contactId}/`,
            method: 'GET',
          });
          return { data: result.data };
        } catch (error) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
    }),
  }),
});

export const {
  useGetJobsQuery,
  useGetJobByIdQuery,
  useGetJobDetailsQuery,
  useGetPublicJobDetailsQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useConvertJobToSeriesMutation,
  useDeleteJobMutation,
  useDeleteJobSeriesMutation,
  useGetJobsByLocationQuery,
  useGetLocationsQuery,
  useGetSubaccountOfficeQuery,

  useGetCalendarJobsQuery,
  useGetAppointmentsCalendarQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useDeleteAppointmentMutation,

  useGetEstimateAppointmentsCalendarQuery,
  useUpdateEstimateStatusMutation,
  useDeleteEstimateMutation,

  useUploadJobImageMutation,
  useUpdateJobPaymentMethodMutation,
  useDeleteJobImageMutation,
  useSearchContactsQuery,
  useGetAddressesByContactQuery,
} = jobsApi;


