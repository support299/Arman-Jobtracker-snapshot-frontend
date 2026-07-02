import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const accountSettingsApi = createApi({
  reducerPath: 'accountSettingsApi',
  baseQuery: axiosBaseQuery({ baseUrl: `${BASE_URL}/accounts/` }),
  tagTypes: ['AccountSettings'],
  endpoints: (builder) => ({
    getAccountSettings: builder.query({
      query: () => ({
        url: 'account-settings/',
      }),
      providesTags: ['AccountSettings'],
    }),
    updateAccountSettings: builder.mutation({
      query: (payload) => ({
        url: 'account-settings/',
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['AccountSettings'],
    }),
    uploadAccountLogo: builder.mutation({
      query: (formData) => ({
        url: 'account-settings/',
        method: 'PATCH',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }),
      invalidatesTags: ['AccountSettings'],
    }),
    refreshAccountCalendars: builder.mutation({
      query: () => ({
        url: 'account-settings/refresh-calendars/',
        method: 'POST',
      }),
      invalidatesTags: ['AccountSettings'],
    }),
  }),
});

export const {
  useGetAccountSettingsQuery,
  useUpdateAccountSettingsMutation,
  useUploadAccountLogoMutation,
  useRefreshAccountCalendarsMutation,
} = accountSettingsApi;
