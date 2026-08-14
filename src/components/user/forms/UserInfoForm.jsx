  import React, { useState, useEffect, useRef } from 'react';
  import {
    Box,
    TextField,
    Typography,
    CircularProgress,
    Paper,
    ListItem,
    ListItemText,
    ClickAwayListener,
    List,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Button,
    Stack,
  } from '@mui/material';
  import { Add, LocationOn } from '@mui/icons-material';
  import axios from 'axios';
  import { useSearchParams } from 'react-router-dom';
  import {
    useGetAddressesByContactQuery,
    useGetInitialDataQuery,
    useSearchContactsQuery,
    useCreateAddressForContactMutation,
  } from '../../../store/api/user/quoteApi';
  import SearchableSelect from '../SearchableSelect';
  import { ContactAddressFormDialog } from '../../contacts/ContactAddressFormDialog';

  // PlacesAutocomplete in plain JSX
  const PlacesAutocomplete = ({ value, onSelect, error, helperText }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const autocompleteService = useRef(null);
    const geocoder = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        geocoder.current = new window.google.maps.Geocoder();
        setGoogleReady(true);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        geocoder.current = new window.google.maps.Geocoder();
        setGoogleReady(true);
      };
      script.onerror = () => {
        // Failed to load Google Maps API
      };
      document.head.appendChild(script);
    }, []);

    useEffect(() => {
      setInputValue(value || '');
    }, [value]);

    const fetchPredictions = (query) => {
      if (!autocompleteService.current || !googleReady) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      autocompleteService.current.getPlacePredictions(
        {
          input: query,
          types: ['geocode', 'establishment'],
        },
        (preds, status) => {
          setLoading(false);
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            preds &&
            preds.length
          ) {
            setSuggestions(preds.slice(0, 5));
          } else {
            setSuggestions([]);
          }
        }
      );
    };

    const handleChange = (e) => {
      const v = e.target.value;
      setInputValue(v);
      setShowSuggestions(true);
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        if (v.trim() === '') {
          setSuggestions([]);
          setLoading(false);
          return;
        }
        fetchPredictions(v);
      }, 250);
    };

    const handleSelect = (prediction) => {
      setInputValue(prediction.description);
      setShowSuggestions(false);
      setSuggestions([]);

      if (!geocoder.current) return;
      geocoder.current.geocode(
        { placeId: prediction.place_id },
        (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const place = results[0];
            const loc = place.geometry.location;
            onSelect({
              address: place.formatted_address,
              latitude: loc.lat(),
              longitude: loc.lng(),
              placeId: prediction.place_id,
            });
          }
        }
      );
    };

    const handleClickAway = () => {
      setShowSuggestions(false);
    };

    return (
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box sx={{ position: 'relative' }}>
            {/* <TextField
              fullWidth
              label="Address"
              value={inputValue}
              onChange={handleChange}
              placeholder="Search for a location..."
              error={error}
              helperText={
                helperText ||
                (googleReady
                  ? 'Start typing to search for places...'
                  : 'Loading Google Places...')
              }
              disabled={!googleReady}
              InputProps={{
                endAdornment: loading && <CircularProgress size={20} />,
              }}
            /> */}

          {showSuggestions && suggestions.length > 0 && (
            <Paper
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1400,
                mt: 1,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s) => (
                <ListItem
                  key={s.place_id}
                  button
                  onClick={() => handleSelect(s)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <LocationOn color="primary" sx={{ mr: 1 }} />
                    <ListItemText
                      primary={s.structured_formatting.main_text}
                      secondary={s.structured_formatting.secondary_text}
                    />
                  </Box>
                </ListItem>
              ))}
            </Paper>
          )}
        </Box>
      </ClickAwayListener>
    );
  };

  export const UserInfoForm = ({ data, onUpdate }) => {
    const [locations, setLocations] = useState([]);
    const [sizeRanges, setSizeRanges] = useState([]);
    const [addAddressOpen, setAddAddressOpen] = useState(false);
    const [searchParams] = useSearchParams();
    const emailParam = searchParams.get("email");
    const hasSetQuotedByRef = useRef(false);

    const location_id = searchParams.get('location_id');

    const { data: initialData, isLoading, error } = useGetInitialDataQuery({location_id:location_id});
    const contactId = data.userInfo?.contactId;

    const { data: addresses, isFetching: isFetchingAddresses } =
      useGetAddressesByContactQuery(contactId, { skip: !contactId });
    const [createAddress, { isLoading: isCreatingAddress }] = useCreateAddressForContactMutation();

    const addressList = Array.isArray(addresses)
      ? addresses
      : addresses?.results || addresses?.data || [];

    useEffect(() => {
      if (initialData) {
        setLocations(initialData.locations);
        setSizeRanges(initialData.size_ranges);
      }
    }, [initialData]);

    // Get project employees from initialData
    const projectEmployees = initialData?.project_employees || [];

    // Auto-select "Quoted By" based on email query parameter
    useEffect(() => {
      if (emailParam && initialData?.project_employees && !hasSetQuotedByRef.current && !data.userInfo?.quoted_by) {
        // Find employee by email (case-insensitive)
        const matchingEmployee = projectEmployees.find(emp => 
          emp.email?.toLowerCase() === emailParam.toLowerCase() ||
          emp.username?.toLowerCase() === emailParam.toLowerCase()
        );
        
        if (matchingEmployee && matchingEmployee.id) {
          hasSetQuotedByRef.current = true;
          onUpdate({
            userInfo: {
              ...data.userInfo,
              quoted_by: matchingEmployee.id,
            },
          });
        }
      }
    }, [emailParam, initialData, projectEmployees, data.userInfo?.quoted_by]);

    const handleChange = (field) => (event) => {
      onUpdate({
        userInfo: {
          ...data.userInfo,
          [field]: event.target.value,
        },
      });
    };

    const handlePlaceSelect = (place) => {
      onUpdate({
        userInfo: {
          ...data.userInfo,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          googlePlaceId: place.placeId,
        },
      });
    };

    const handleContactSelect = (contact) => {
      onUpdate({
        userInfo: {
          ...data.userInfo,
          contactId: contact.id,
          contact,
          contactName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
          contactPhone: contact.phone,
          addressId: "",
          selectedHouseSize: "",
        },
      });
    };

    const applySelectedAddress = (selected) => {
      if (!selected) return;
      onUpdate({
        userInfo: {
          ...data.userInfo,
          addressId: selected.id,
          selectedHouseSize: selected?.property_sqft ? String(selected.property_sqft) : "",
        },
      });
    };

    const handleAddressSelect = (addressId) => {
      const selected = addressList.find(
        (a) => String(a.id) === String(addressId),
      );
      applySelectedAddress(selected);
    };

    const handleCreateAddress = async (payload) => {
      if (!contactId) return;
      const created = await createAddress({ contactId, ...payload }).unwrap();
      applySelectedAddress(created);
    };

    const formatAddressLabel = (addr) => {
      const parts = [addr?.street_address, addr?.city, addr?.state, addr?.postal_code].filter(Boolean);
      const line = parts.join(', ');
      return addr?.name ? `${addr.name} — ${line}` : line || 'Address';
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Your Information
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please provide your contact information to proceed with the booking.
        </Typography>

        {/* <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}> */}
        <Box display="flex" flexDirection="column" gap={3}>
          <Typography variant="h6" gutterBottom>
            Select Contact & Address
          </Typography>

          <SearchableSelect
            label="Contacts"
            useSearchHook={useSearchContactsQuery}
            onSelect={handleContactSelect}
            location_id={location_id}
            emailParam={emailParam}
            value={data.userInfo?.contact?.first_name + data?.userInfo?.contact?.last_name}
          />

          {contactId && (
            <Box>
              {isFetchingAddresses ? (
                <CircularProgress size={24} />
              ) : (
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                    <TextField
                      select
                      fullWidth
                      label="Select Address"
                      value={data.userInfo?.addressId || ""}
                      onChange={(e) => handleAddressSelect(e.target.value)}
                      helperText={
                        addressList.length === 0
                          ? 'No saved addresses for this contact. Add one below.'
                          : ''
                      }
                    >
                      <MenuItem value="">
                        <em>Select an address</em>
                      </MenuItem>
                      {addressList.map((addr) => (
                        <MenuItem key={addr.id} value={addr.id}>
                          {formatAddressLabel(addr)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={() => setAddAddressOpen(true)}
                      disabled={isCreatingAddress}
                      sx={{ minWidth: { sm: 160 }, whiteSpace: 'nowrap' }}
                    >
                      Add address
                    </Button>
                  </Stack>
                </Stack>
              )}

              <ContactAddressFormDialog
                open={addAddressOpen}
                onClose={() => setAddAddressOpen(false)}
                onSubmit={handleCreateAddress}
                busy={isCreatingAddress}
                mode="create"
              />
            </Box>
          )}

          <TextField
            select
            fullWidth
            label="Select Location"
            value={data.userInfo?.locationId || ""}
            onChange={(e) =>
              onUpdate({
                userInfo: {
                  ...data.userInfo,
                  locationId: e.target.value || null,
                },
              })
            }
            disabled={isLoading || !locations?.length}
            helperText={isLoading ? "Loading locations..." : !locations?.length ? "No locations available" : ""}
          >
            <MenuItem value="">
              <em>Select a location</em>
            </MenuItem>
            {locations?.map((loc) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.address || loc.name || loc.id}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="Select House Size"
            value={data.userInfo?.selectedHouseSize || ''}
            onChange={(e) => {
              const onlyNums = e.target.value.replace(/\D/g, ""); // remove non-digits
              handleChange('selectedHouseSize')({
                target: { value: onlyNums }
              });
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={data.userInfo?.first_time || false}
                onChange={(e) =>
                  onUpdate({
                    userInfo: {
                      ...data.userInfo,
                      first_time: e.target.checked,
                    },
                  })
                }
              />
            }
            label="Is first time"
          />

          {/* ✅ Select for "Quoted by" - using project_employees from API */}
          <TextField
            select
            fullWidth
            label="Quoted By"
            value={(() => {
              // Ensure value is always the employee ID (number)
              const currentValue = data.userInfo?.quoted_by;
              if (!currentValue) return "";
              
              // If it's already a number, use it
              if (typeof currentValue === 'number') return currentValue;
              
              // If it's a string that's a number, convert it
              if (typeof currentValue === 'string' && !isNaN(Number(currentValue))) {
                return Number(currentValue);
              }
              
              // If it's a name (string), try to find matching employee ID
              const matchingEmployee = projectEmployees.find(emp => 
                emp.name === currentValue || 
                `${emp.first_name || ''} ${emp.last_name || ''}`.trim() === currentValue ||
                emp.username === currentValue ||
                emp.email === currentValue
              );
              
              return matchingEmployee ? matchingEmployee.id : "";
            })()}
            onChange={(e) => {
              // Ensure we store the ID as a number
              const employeeId = typeof e.target.value === 'string' ? Number(e.target.value) : e.target.value;
              onUpdate({
                userInfo: {
                  ...data.userInfo,
                  quoted_by: employeeId, // Store employee ID as number
                },
              });
            }}
            disabled={isLoading || projectEmployees.length === 0}
            helperText={isLoading ? "Loading employees..." : projectEmployees.length === 0 ? "No employees available" : ""}
          >
            {projectEmployees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username || employee.email}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
    );
  };

  export default UserInfoForm;
