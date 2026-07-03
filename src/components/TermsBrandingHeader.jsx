import { Skeleton } from '@mui/material';
import { useAccountBranding } from '../hooks/useAccountBranding';
import { resolveCompanyLogoUrl } from '../utils/companyProfile';
import CompanyLogoPlaceholder from './CompanyLogoPlaceholder';

const TermsBrandingHeader = ({ profile: profileProp, locationId, isLoading: isLoadingProp }) => {
  const { profile: fetchedProfile, isLoading, isReady } = useAccountBranding({ locationId });
  const profile = profileProp || fetchedProfile;
  const showLoading = isLoadingProp ?? isLoading ?? !isReady;
  const logoSrc = resolveCompanyLogoUrl(profile?.logoUrl);

  return (
    <nav className="bg-white border-b py-2 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-24">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            {showLoading ? (
              <CompanyLogoPlaceholder maxHeight="56px" maxWidth="56px" rounded />
            ) : (
              <img
                src={logoSrc}
                alt={`${profile.name} Logo`}
                className="h-14 w-14 rounded-lg object-contain"
              />
            )}
            <div className="h-12 w-px bg-gray-300" />
            <div>
              {showLoading ? (
                <>
                  <Skeleton variant="text" width={180} height={28} />
                  <Skeleton variant="text" width={140} height={20} sx={{ mt: 0.5 }} />
                </>
              ) : (
                <>
                  <h1 className="text-xl text-gray-900">{profile.name}</h1>
                  {profile.tagline ? (
                    <p className="text-sm text-gray-600">{profile.tagline}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default TermsBrandingHeader;
