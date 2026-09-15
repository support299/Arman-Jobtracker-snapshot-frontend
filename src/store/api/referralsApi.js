import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery, BASE_URL } from '../axios/axios'

export const referralsApi = createApi({
  reducerPath: 'referralsApi',
  baseQuery: axiosBaseQuery({ baseUrl: `${BASE_URL}/referrals/` }),
  tagTypes: ['ReferralDashboard', 'ReferralProgram', 'ReferralContactCredit', 'ReferralGiftCard'],
  endpoints: (builder) => ({
    getReferralGiftCard: builder.query({
      query: () => ({ url: 'owner/gift-card/' }),
      providesTags: ['ReferralGiftCard'],
    }),
    updateReferralGiftCard: builder.mutation({
      query: (payload) => ({
        url: 'owner/gift-card/',
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['ReferralGiftCard'],
    }),
    getReferralDashboard: builder.query({
      query: () => ({ url: 'owner/dashboard/' }),
      providesTags: ['ReferralDashboard'],
    }),
    getReferralProgram: builder.query({
      query: () => ({ url: 'owner/program/' }),
      providesTags: ['ReferralProgram'],
    }),
    updateReferralProgram: builder.mutation({
      query: (payload) => ({
        url: 'owner/program/',
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['ReferralDashboard', 'ReferralProgram'],
    }),
    getContactReferralCredit: builder.query({
      query: (contactId) => ({
        url: `owner/contact/${contactId}/credit/`,
      }),
      providesTags: (_r, _e, contactId) => [{ type: 'ReferralContactCredit', id: contactId }],
    }),
    ensureReferralLink: builder.mutation({
      query: (contactId) => ({
        url: 'owner/ensure-link/',
        method: 'POST',
        data: { contact_id: contactId },
      }),
      invalidatesTags: ['ReferralDashboard'],
    }),
    getPublicClaim: builder.query({
      query: (code) => ({ url: `public/claim/${encodeURIComponent(code)}/` }),
    }),
    submitReferralClaim: builder.mutation({
      query: (body) => ({
        url: 'public/claim/',
        method: 'POST',
        data: body,
      }),
    }),
    getCustomerHub: builder.query({
      query: (code) => ({ url: `public/customer/${encodeURIComponent(code)}/` }),
    }),
    getPublicProgram: builder.query({
      query: (locationId) => ({
        url: 'public/program/',
        params: { location_id: locationId },
      }),
    }),
  }),
})

export const {
  useGetReferralGiftCardQuery,
  useUpdateReferralGiftCardMutation,
  useGetReferralDashboardQuery,
  useGetReferralProgramQuery,
  useUpdateReferralProgramMutation,
  useGetContactReferralCreditQuery,
  useEnsureReferralLinkMutation,
  useGetPublicClaimQuery,
  useSubmitReferralClaimMutation,
  useGetCustomerHubQuery,
  useGetPublicProgramQuery,
} = referralsApi
