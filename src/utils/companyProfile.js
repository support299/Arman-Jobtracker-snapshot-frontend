import { axiosInstance, BASE_URL } from '../store/axios/axios';
import { ALL_DAY_PROJECTS_LOCATION_ID } from './bookingRedirect';
import { DEFAULT_ACCOUNT_CURRENCY, resolveAccountCurrency } from './accountCurrency';

const DEFAULT_COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'TruShine Window Cleaning';
const DEFAULT_ABBREVIATION = 'TWC';

const LOCATION_ABBREVIATIONS = {
  [ALL_DAY_PROJECTS_LOCATION_ID]: 'ADP',
};

const DEFAULT_LOGO =
  'https://storage.googleapis.com/msgsndr/b8qvo7VooP3JD3dIZU42/media/683efc8fd5817643ff8194f0.jpeg';

/** Fallback logo when a subaccount has not uploaded branding yet. */
export const DEFAULT_SERVICE_COMPANY_LOGO =
  import.meta.env.VITE_DEFAULT_COMPANY_LOGO_URL ||
  import.meta.env.VITE_COMPANY_LOGO_URL ||
  DEFAULT_LOGO ||
  '/placeholder.svg';

export function resolveCompanyLogoUrl(logoUrl) {
  const custom = logoUrl != null ? String(logoUrl).trim() : '';
  return custom || DEFAULT_SERVICE_COMPANY_LOGO;
}

const pickAccountField = (accountInfo, keys) => {
  for (const key of keys) {
    const value = accountInfo?.[key];
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const formatWebsite = (website) => {
  if (!website) return '';
  let value = website.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https?:\/\//i, '');
  }
  return value;
};

export function deriveAbbreviationFromName(companyName) {
  if (!companyName) return DEFAULT_ABBREVIATION;
  const normalized = companyName.trim();
  if (/all\s*day\s*projects/i.test(normalized)) return 'ADP';
  if (/trushine/i.test(normalized)) return DEFAULT_ABBREVIATION;

  const words = normalized.split(/\s+/).filter((w) => w && !/^(and|the|of|&|a)$/i.test(w));
  if (words.length === 0) return DEFAULT_ABBREVIATION;
  return words.map((w) => w[0]).join('').toUpperCase();
}

export function resolveCompanyAbbreviation(companyName, { locationId, accountInfo } = {}) {
  const fromApi = pickAccountField(accountInfo, [
    'abbreviation',
    'company_abbreviation',
    'short_code',
    'short_name',
  ]);
  if (fromApi) return fromApi.toUpperCase();

  if (locationId && LOCATION_ABBREVIATIONS[locationId]) {
    return LOCATION_ABBREVIATIONS[locationId];
  }

  if (companyName === DEFAULT_COMPANY_NAME) return DEFAULT_ABBREVIATION;
  return deriveAbbreviationFromName(companyName);
}

export function getDefaultCompanyProfile() {
  return {
    name: DEFAULT_COMPANY_NAME,
    abbreviation: DEFAULT_ABBREVIATION,
    tagline: import.meta.env.VITE_COMPANY_TAGLINE || 'Professional Cleaning Services',
    logoUrl: resolveCompanyLogoUrl(import.meta.env.VITE_COMPANY_LOGO_URL || DEFAULT_LOGO),
    website: import.meta.env.VITE_COMPANY_WEBSITE || 'www.trushinewindowcleaning.com',
    address: import.meta.env.VITE_COMPANY_ADDRESS || '3525 Murdock St, Houston, TX 77047',
    phone: import.meta.env.VITE_COMPANY_PHONE || '832-713-3545',
    email: import.meta.env.VITE_COMPANY_EMAIL || 'trushinehouston@gmail.com',
    locationName: null,
    domain: null,
    currency: DEFAULT_ACCOUNT_CURRENCY,
    fromAccountInfo: false,
  };
}

export function mapAccountInfoToCompanyProfile(accountInfo) {
  const defaults = getDefaultCompanyProfile();
  if (!accountInfo) return defaults;

  const name =
    pickAccountField(accountInfo, ['account_name', 'location_name', 'company_name']) ||
    defaults.name;

  const locationName = pickAccountField(accountInfo, ['location_name']) || null;
  const tagline =
    pickAccountField(accountInfo, ['tagline']) ||
    (locationName && locationName !== name ? locationName : '');

  const website = formatWebsite(
    pickAccountField(accountInfo, ['website', 'company_website']) ||
      pickAccountField(accountInfo, ['domain'])
  );

  const address = pickAccountField(accountInfo, [
    'address',
    'business_address',
    'company_address',
    'street_address',
    'full_address',
    'location_address',
  ]);

  const phone = pickAccountField(accountInfo, [
    'phone',
    'business_phone',
    'company_phone',
    'phone_number',
    'contact_phone',
  ]);

  const email = pickAccountField(accountInfo, [
    'email',
    'business_email',
    'company_email',
    'contact_email',
  ]);

  const abbreviation = resolveCompanyAbbreviation(name, {
    locationId: accountInfo.location_id,
    accountInfo,
  });

  return {
    name,
    abbreviation,
    tagline,
    logoUrl: resolveCompanyLogoUrl(pickAccountField(accountInfo, ['logo_url', 'logo'])),
    website,
    address,
    phone,
    email,
    locationName,
    domain: pickAccountField(accountInfo, ['domain']) || null,
    locationId: accountInfo.location_id || null,
    currency: resolveAccountCurrency({ accountCurrency: accountInfo.currency }),
    fromAccountInfo: true,
  };
}

export async function fetchCompanyProfileByLocationId(locationId) {
  if (!locationId) return getDefaultCompanyProfile();

  const { data } = await axiosInstance.get(`${BASE_URL}/quote/account-info/`, {
    params: { location_id: locationId },
  });

  return mapAccountInfoToCompanyProfile(data);
}

/** Lines to show on quote PDF cover (address, phone, email, website). */
export function getCompanyContactLines(profile) {
  if (!profile) return [];
  return [profile.address, profile.phone, profile.email, profile.website].filter(Boolean);
}

/** Replace legacy TruShine legal branding with the active account/location name and abbreviation. */
export function applyCompanyNameToTermsText(text, companyName, companyAbbreviation) {
  if (!text || !companyName) return text;

  const abbr =
    companyAbbreviation ||
    resolveCompanyAbbreviation(companyName);

  return text
    .replaceAll('TruShine Window Cleaning', companyName)
    .replaceAll("TruShine's", `${companyName}'s`)
    .replaceAll('TruShine / TWC', `${companyName} / ${abbr}`)
    .replaceAll('TruShine', companyName)
    .replace(/\bTWC\b/g, abbr);
}

export function getLoadingCompanyProfile() {
  return {
    name: '',
    abbreviation: '',
    tagline: '',
    logoUrl: null,
    website: '',
    address: '',
    phone: '',
    email: '',
    locationName: null,
    domain: null,
    currency: DEFAULT_ACCOUNT_CURRENCY,
    isPlaceholder: true,
    fromAccountInfo: false,
  };
}
