import { configureStore } from '@reduxjs/toolkit';
import { servicesApi } from './api/servicesApi';
import { locationsApi } from './api/locationsApi';
import { ghlLocationsApi } from './api/ghlLocationsApi';
import { bookingApi } from './api/bookingApi';
import { packagesApi } from './api/packagesApi';
import { featuresApi } from './api/featuresApi';
import { questionsApi } from './api/questionsApi';
import { packageFeaturesApi } from './api/packageFeaturesApi';
import { questionOptionsApi } from './api/questionOptionsApi';
import servicesSlice from './slices/servicesSlice';
import locationsSlice from './slices/locationsSlice';
import ghlLocationsSlice from './slices/ghlLocationsSlice';
import authSlice from './slices/authSlice';
import { createOptionPricingApi } from './api/optionPricing';
import { contactsApi } from './api/user/contactsApi';
import { userServicesApi } from './api/user/userServicesApi';
import { priceApi } from './api/user/priceApi';
import { quotesApi } from './api/user/quotesApi';
import { houseSizesApi } from './api/houseSizesApi';
import { questionSubQuestionsApi } from './api/questionSubQuestionsApi';
import { quoteApi } from './api/user/quoteApi';
import persistReducer from 'redux-persist/lib/persistReducer';
import storage from 'redux-persist/lib/storage';
import persistStore from 'redux-persist/lib/persistStore';

import bookingReducer from './slices/bookingSlice';
import { globalPriceApi } from './api/globalPriceApi';
import { jobsApi } from './api/jobsApi';
import { assigneesApi } from './api/assigneesApi';
import { payrollApi } from './api/payrollApi';
import { dashboardApi } from './api/dashboardApi';
import { contactProfileApi } from './api/contactProfileApi';
import { referralsApi } from './api/referralsApi';
import { onestepgpsApi } from './api/onestepgpsApi';

const persistConfig = {
  key: 'booking',
  storage,
  whitelist: ['booking'] // persist only booking slice
};

const persistedBookingReducer = persistReducer(persistConfig, bookingReducer);

export const store = configureStore({
  reducer: {
    booking: persistedBookingReducer,
    services: servicesSlice,
    locations: locationsSlice,
    ghlLocations: ghlLocationsSlice,

    auth: authSlice,
    [servicesApi.reducerPath]: servicesApi.reducer,
    [locationsApi.reducerPath]: locationsApi.reducer,
    [ghlLocationsApi.reducerPath]: ghlLocationsApi.reducer,
    [bookingApi.reducerPath]: bookingApi.reducer,
    [packagesApi.reducerPath]: packagesApi.reducer,
    [featuresApi.reducerPath]: featuresApi.reducer,
    [questionsApi.reducerPath]: questionsApi.reducer,
    [packageFeaturesApi.reducerPath]: packageFeaturesApi.reducer,
    [questionOptionsApi.reducerPath]: questionOptionsApi.reducer,
    [createOptionPricingApi.reducerPath]: createOptionPricingApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
    [userServicesApi.reducerPath]: userServicesApi.reducer,
    [priceApi.reducerPath]: priceApi.reducer,
    [quotesApi.reducerPath]: quotesApi.reducer,
    [houseSizesApi.reducerPath]: houseSizesApi.reducer,
    [questionSubQuestionsApi.reducerPath]: questionOptionsApi.reducer,
    [quoteApi.reducerPath]: quoteApi.reducer,
    [globalPriceApi.reducerPath]: globalPriceApi.reducer,
    [jobsApi.reducerPath]: jobsApi.reducer,
    [assigneesApi.reducerPath]: assigneesApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [contactProfileApi.reducerPath]: contactProfileApi.reducer,
    [payrollApi.reducerPath]: payrollApi.reducer,
    [referralsApi.reducerPath]: referralsApi.reducer,
    [onestepgpsApi.reducerPath]: onestepgpsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
        ],
      },
    })
      .concat(servicesApi.middleware)
      .concat(locationsApi.middleware)
      .concat(ghlLocationsApi.middleware)
      .concat(bookingApi.middleware)
      .concat(packagesApi.middleware)
      .concat(featuresApi.middleware)
      .concat(questionsApi.middleware)
      .concat(packageFeaturesApi.middleware)
      .concat(questionOptionsApi.middleware)
      .concat(createOptionPricingApi.middleware)
      .concat(contactsApi.middleware)
      .concat(userServicesApi.middleware)
      .concat(priceApi.middleware)
      .concat(quotesApi.middleware)
      .concat(houseSizesApi.middleware)
      .concat(questionSubQuestionsApi.middleware)
      .concat(quoteApi.middleware)
      .concat(globalPriceApi.middleware)
      .concat(jobsApi.middleware)
      .concat(assigneesApi.middleware)
      .concat(dashboardApi.middleware)
      .concat(contactProfileApi.middleware)
      .concat(payrollApi.middleware)
      .concat(referralsApi.middleware)
      .concat(onestepgpsApi.middleware)
});

export const persistor = persistStore(store);

export default store;