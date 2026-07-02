import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery, BASE_URL } from '../axios/axios';

export const contactProfileApi = createApi({
  reducerPath: 'contactProfileApi',
  baseQuery: axiosBaseQuery({ baseUrl: BASE_URL + '/accounts/' }),
  tagTypes: ['ContactAddress', 'DashboardContact'],
  endpoints: (builder) => ({
    getContactAddresses: builder.query({
      query: (ghlContactId) => ({
        url: `contacts/${encodeURIComponent(String(ghlContactId))}/addresses/`,
      }),
      providesTags: (result, error, ghlContactId) => [
        { type: 'ContactAddress', id: String(ghlContactId) },
      ],
    }),
    createContactAddress: builder.mutation({
      query: ({ ghlContactId, ...payload }) => ({
        url: `contacts/${encodeURIComponent(String(ghlContactId))}/addresses/`,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: (result, error, { ghlContactId }) => [
        { type: 'ContactAddress', id: String(ghlContactId) },
        { type: 'DashboardContact', id: String(ghlContactId) },
      ],
    }),
    updateContactAddress: builder.mutation({
      query: ({ ghlContactId, addressId, ...payload }) => ({
        url: `contacts/${encodeURIComponent(String(ghlContactId))}/addresses/${addressId}/`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: (result, error, { ghlContactId }) => [
        { type: 'ContactAddress', id: String(ghlContactId) },
        { type: 'DashboardContact', id: String(ghlContactId) },
      ],
    }),
    deleteContactAddress: builder.mutation({
      query: ({ ghlContactId, addressId }) => ({
        url: `contacts/${encodeURIComponent(String(ghlContactId))}/addresses/${addressId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { ghlContactId }) => [
        { type: 'ContactAddress', id: String(ghlContactId) },
        { type: 'DashboardContact', id: String(ghlContactId) },
      ],
    }),
  }),
});

export const {
  useGetContactAddressesQuery,
  useCreateContactAddressMutation,
  useUpdateContactAddressMutation,
  useDeleteContactAddressMutation,
} = contactProfileApi;
