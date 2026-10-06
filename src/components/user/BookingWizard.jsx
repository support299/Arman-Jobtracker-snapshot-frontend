"use client"
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Circle, Loader2 } from "lucide-react"
import { useCreateQuoteMutation } from "../../store/api/user/quotesApi"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import UserInfoForm from "./forms/UserInfoForm"
import PublicCustomerInfoForm from "./forms/PublicCustomerInfoForm"
import ServiceSelectionForm from "./forms/ServiceSelectionForm"
import PackageSelectionForm from "./forms/PackageSelectionForm"
import QuestionsForm from "./forms/QuestionsForm"
import CheckoutSummary from "./forms/CheckoutSummary"
import MultiServiceSelectionForm from "./forms/MultiServiceSelectionForm"
import ImageUploadForm from "./forms/ImageUploadForm"
import { useCreateQuestionResponsesMutation, useCreateServiceToSubmissionMutation, useCreateSubmissionMutation, useStartPublicSubmissionMutation, useGetQuoteDetailsQuery, useSubmitOnlyCustomProductsMutation, useSubmitQuoteMutation, useUpdateSubmissionMutation, useUpdateAdditionalDataMutation } from "../../store/api/user/quoteApi"
import { useDispatch } from "react-redux"
import { resetBookingData } from "../../store/slices/bookingSlice"
import { Box, Typography, Card, CardContent } from "@mui/material"
import PoweredBy from "../PoweredBy"
import TenantModuleSwitcher from "../admin/TenantModuleSwitcher"
import { resolveBrandingLocationId, useAccountBranding } from "../../hooks/useAccountBranding"

import SignatureCanvas from "react-signature-canvas";
import { AdminPanelSettings, PostAdd } from "@mui/icons-material"


const steps = [
  "Your Information",
  "Select Services",
  "Answer Questions",
  "Upload Images",
  "Review & Submit"
];

const initialBookingData = {
  submission_id: null,
  userInfo: {
    firstName: "",
    phone: "",
    email: "",
    address: "",
    latitude: "",
    longitude: "",
    googlePlaceId: "",
    contactId: null,
    selectedLocation: null,
    selectedHouseSize: null,
    locationId: null
  },
  selectedServices: [],
  selectedService: null,
  selectedPackage: null,
  questionAnswers: {},
  pricing: { basePrice: 0, tripSurcharge: 0, questionAdjustments: 0, totalPrice: 0 },
  quoteDetails: null,
  selectedPackages: [],
};

function buildQuoteDetailsHref(searchParams, submissionId, extraParams = {}) {
  const id = String(submissionId ?? '').trim().split(/\s+/)[0];
  const locationId = resolveBrandingLocationId(searchParams);
  const params = new URLSearchParams();
  if (locationId) params.set('location_id', locationId);
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `/quote/details/${id}?${qs}` : `/quote/details/${id}`;
}

export const BookingWizard = ({ mode } = {}) => {
  const authUser = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.access);
  const isLoggedIn = Boolean(authUser && accessToken);

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isPublicMode = mode === 'public' || location.pathname.startsWith('/public-quote');
  const { locationId: brandingLocationId } = useAccountBranding();
  const submissionIdFromUrl = searchParams.get("submission_id");
  const paramEmail = searchParams.get("email")
  const ghlLocationId = resolveBrandingLocationId(searchParams) || brandingLocationId;

  const [signature, setSignature] = useState('');
  const [signatureTimestamp, setSignatureTimestamp] = useState(null);
  const [addiditional_notes, setAdditionalNotes] = useState();
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Fetch if submission_id present
  const {
    data: submissionData,
    isSuccess,
    isFetching,
    refetch: refetchQuoteDetails,
  } = useGetQuoteDetailsQuery(submissionIdFromUrl, {
    skip: !submissionIdFromUrl,
    refetchOnMountOrArgChange: true,
  });

  const [activeStep, setActiveStep] = useState(0)
  const [bookingData, setBookingData] = useState(() => {
    const saved = '';
    return saved ? JSON.parse(saved) : {
      submission_id: null,
      userInfo: { firstName: "", phone: "", email: "", address: "", latitude: "", longitude: "", googlePlaceId: "", contactId: null, selectedLocation: null, selectedHouseSize: null, locationId: null },
      selectedServices: [],
      selectedService: null,
      selectedPackage: null,
      questionAnswers: {},
      pricing: { basePrice: 0, tripSurcharge: 0, questionAdjustments: 0, totalPrice: 0 },
      quoteDetails: null,
      selectedPackages: [],
    };
  });

  useEffect(() => {
  if (isSuccess && submissionData) {
    // Get quoted_by - it might be an ID (number) or name (string) from API
    // We'll keep it as-is for now, but ensure it's converted to ID when needed
    const quotedByValue = submissionData?.quote_schedule?.quoted_by;
    
    const transformedData = {
      submission_id: submissionData.id,
      userInfo: {
        firstName: submissionData.customer_name || "",
        phone: submissionData.customer_phone || "",
        email: submissionData.customer_email || "",
        address: submissionData.address || "",
        latitude: submissionData.latitude || "",
        longitude: submissionData.longitude || "",
        googlePlaceId: submissionData.google_place_id || "",
        contactId: submissionData?.contact?.id,
        selectedLocation: submissionData.location || null,
        locationId: submissionData.location?.id ?? submissionData.location ?? null,
        selectedHouseSize: submissionData.house_sqft || null,
        contact: submissionData?.contact,
        addressId: submissionData?.address?.id,
        first_time: submissionData?.quote_schedule?.first_time,
        customerNotes:
          submissionData?.additional_data?.customer_notes
          || submissionData?.additional_data?.additional_notes
          || '',
        quoted_by: typeof quotedByValue === 'number' ? quotedByValue : (typeof quotedByValue === 'string' && !isNaN(Number(quotedByValue)) ? Number(quotedByValue) : quotedByValue)
      },
      selectedServices: submissionData.service_selections.map((s) => ({
        id: s.service_details.id,
        name: s.service_details.name,
      })),
      selectedService: null,
      selectedPackage: null,
      selectedPackages: submissionData.service_selections
        .flatMap((s) =>
          s.package_quotes.filter((p) => p.is_selected).map((pkg) => ({
            service_selection_id: s.id,
            package_id: pkg.package,
            package_name: pkg.package_name,
            total_price: pkg.total_price,
          }))
        ),
      // FIXED: Proper question answers transformation
      questionAnswers: submissionData.service_selections.reduce((acc, service) => {
        service.question_responses.forEach((response) => {
          const serviceId = service.service_details.id;
          const questionId = response.question;
          
          // Handle different question types
          switch (response.question_type) {
            case "yes_no":
            case "conditional":
              const key = `${serviceId}_${questionId}`;
              acc[key] = response.yes_no_answer ? "yes" : "no";
              break;
              
            case "describe":
            case "options":
              if (response.option_responses && response.option_responses.length > 0) {
                const key = `${serviceId}_${questionId}`;
                // For single selection, use the first option
                acc[key] = response.option_responses[0].option;
              }
              break;
              
            case "quantity":
              response.option_responses.forEach((optResponse) => {
                // Mark the option as selected
                const selectedKey = `${serviceId}_${questionId}_${optResponse.option}`;
                acc[selectedKey] = "selected";
                
                // Store the quantity
                const quantityKey = `${serviceId}_${questionId}_${optResponse.option}_quantity`;
                acc[quantityKey] = optResponse.quantity;
              });
              break;
              
            case "multiple_yes_no":
              response.sub_question_responses.forEach((subResponse) => {
                const subKey = `${serviceId}_${questionId}_${subResponse.sub_question_id || subResponse.sub_question}`;
                acc[subKey] = subResponse.answer ? "yes" : "no";
              });
              break;
              
            default:
              // Unknown question type
              break;
          }
        });
        return acc;
      }, {}),
      pricing: {
        basePrice: submissionData.total_base_price || 0,
        tripSurcharge: submissionData.total_surcharges || 0,
        questionAdjustments: submissionData.total_adjustments || 0,
        totalPrice: submissionData.final_total || 0,
      },
      quoteDetails: submissionData,
    };
    
    setBookingData(transformedData);
    
    // Load additional notes from API response (public quote only)
    if (isPublicMode && submissionData.additional_data?.additional_notes) {
      setAdditionalNotes(submissionData.additional_data.additional_notes);
    }
  }
}, [isSuccess, submissionData]);

  useLayoutEffect(() => {
    if (isSuccess && submissionData) {
      if (submissionData?.status==="submitted" || submissionData?.status==="accepted" || submissionData?.status==="rejected"){
        navigate(buildQuoteDetailsHref(searchParams, submissionData?.id))
      }
      setActiveStep(4); // Updated to step 4 (Review & Submit) since we added image upload step
    }
  }, [isSuccess, submissionData]);

  // // Save to localStorage whenever bookingData changes
  // useEffect(() => {
  //   localStorage.setItem("bookingData", JSON.stringify(bookingData));
  // }, [bookingData]);

  const [createSubmission, { isLoading: creating }] = useCreateSubmissionMutation()
  const [startPublicSubmission, { isLoading: startingPublic }] = useStartPublicSubmissionMutation()
  const [updateSubmission, { isLoading: updating }] = useUpdateSubmissionMutation()
  const [updateAdditionalData] = useUpdateAdditionalDataMutation()
  const [createQuote, { isLoading: creatingQuote }] = useCreateQuoteMutation()
  const [createQuestionResponses, { isLoading: submittingResponses }] = useCreateQuestionResponsesMutation()
  const [submitOnlyCustomProducts] = useSubmitOnlyCustomProductsMutation()

  const [addServiceToSubmission] = useCreateServiceToSubmissionMutation();
  
  const isSavingContact = creating || updating || startingPublic
  const navigate = useNavigate()

  // Use useCallback to prevent infinite loops
  const updateBookingData = useCallback((stepData) => {
    setBookingData((prev) => ({ ...prev, ...stepData }))
  }, [])

  const [submitQuote, { isLoading: submittingQuote }] = useSubmitQuoteMutation();

  // Helper function to transform question answers to API format
  const transformQuestionAnswersToAPIFormat = (questionAnswers, selectedServices) => {
    const serviceResponses = {};

    // Initialize service responses for each selected service
    selectedServices.forEach(service => {
      serviceResponses[service.id] = [];
    });

    // Group answers by service and question
    Object.entries(questionAnswers).forEach(([key, value]) => {
      const parts = key.split('_');
      if (parts.length < 2) return;

      const serviceId = parts[0];
      const questionId = parts[1];

      if (!serviceResponses[serviceId]) return;

      // Find existing response for this question
      let existingResponse = serviceResponses[serviceId].find(r => r.question_id === questionId);

      if (parts.length === 2) {
        // Simple question answer (yes_no, describe, options)
        if (!existingResponse) {
          // Determine question type based on the answer format
          if (value === 'yes' || value === 'no') {
            existingResponse = {
              question_id: questionId,
              question_type: "yes_no",
              yes_no_answer: value === 'yes'
            };
          } else {
            existingResponse = {
              question_id: questionId,
              question_type: "describe", // or "options"
              selected_options: [{
                option_id: value,
                quantity: 1
              }]
            };
          }
          serviceResponses[serviceId].push(existingResponse);
        }
      } else if (parts.length === 3) {
        // Sub-question or option-based answer
        const thirdPart = parts[2];

        // Check if this is a sub-question (multiple_yes_no)
        if (value === 'yes' || value === 'no') {
          if (!existingResponse) {
            existingResponse = {
              question_id: questionId,
              question_type: "multiple_yes_no",
              sub_question_answers: []
            };
            serviceResponses[serviceId].push(existingResponse);
          }

          const subQuestionAnswer = {
            sub_question_id: thirdPart,
            answer: value === 'yes'
          };

          // Update or add sub-question answer
          const existingSubAnswer = existingResponse.sub_question_answers.find(
            sa => sa.sub_question_id === thirdPart
          );
          if (existingSubAnswer) {
            existingSubAnswer.answer = value === 'yes';
          } else {
            existingResponse.sub_question_answers.push(subQuestionAnswer);
          }
        } else if (value === 'selected') {
          // Quantity question option selection
          if (!existingResponse) {
            existingResponse = {
              question_id: questionId,
              question_type: "quantity",
              selected_options: []
            };
            serviceResponses[serviceId].push(existingResponse);
          }

          // Check if option already exists
          const existingOption = existingResponse.selected_options.find(
            opt => opt.option_id === thirdPart
          );
          if (!existingOption) {
            existingResponse.selected_options.push({
              option_id: thirdPart,
              quantity: 1
            });
          }
        }
      } else if (parts.length === 4 && parts[3] === 'quantity') {
        // Quantity value for an option
        if (!existingResponse) {
          existingResponse = {
            question_id: questionId,
            question_type: "quantity",
            selected_options: []
          };
          serviceResponses[serviceId].push(existingResponse);
        }

        const optionId = parts[2];
        const existingOption = existingResponse.selected_options.find(
          opt => opt.option_id === optionId
        );
        if (existingOption) {
          existingOption.quantity = parseInt(value) || 1;
        }
      }
    });

    return serviceResponses;
  };

  

  const handleNext = async () => {
    if (activeStep === 0) {
      const {submission_id} = bookingData

      if (isPublicMode) {
        const info = bookingData.userInfo || {};
        const required = [
          info.firstName,
          info.email,
          info.phone,
          info.streetAddress,
          info.city,
          info.state,
          info.postalCode,
          info.selectedHouseSize,
        ];
        if (required.some((v) => !v || String(v).trim() === '')) {
          alert('Please fill in all required contact and address fields.');
          return;
        }
        if (!ghlLocationId) {
          alert('Missing location. Please open this page from a valid quote link.');
          return;
        }

        try {
          if (submission_id) {
            await updateSubmission({
              id: submission_id,
              house_sqft: info.selectedHouseSize,
              first_time: Boolean(info.first_time),
            }).unwrap();
            const notes = info.customerNotes || '';
            setAdditionalNotes(notes);
            await updateAdditionalData({
              submissionId: submission_id,
              payload: {
                additional_data: {
                  additional_notes: notes,
                  customer_notes: notes,
                },
              },
            }).unwrap();
          } else {
            const response = await startPublicSubmission({
              first_name: info.firstName,
              last_name: info.lastName || '',
              email: info.email,
              phone: info.phone,
              street_address: info.streetAddress,
              city: info.city,
              state: info.state,
              postal_code: info.postalCode,
              gate_code: info.gateCode || '',
              property_type: info.propertyType || 'residential',
              house_sqft: Number(info.selectedHouseSize),
              first_time: Boolean(info.first_time),
              customer_notes: info.customerNotes || '',
              location_id: ghlLocationId,
            }).unwrap();

            updateBookingData({
              submission_id: response.submission_id,
              userInfo: {
                ...info,
                contactId: response.contact_id,
                addressId: response.address_id,
              },
              selectedCustomProducts: [],
            });
            setAdditionalNotes(info.customerNotes || '');
          }
          setActiveStep((prev) => prev + 1);
        } catch (err) {
          const detail =
            err?.data?.error ||
            err?.data?.detail ||
            (typeof err?.data === 'string' ? err.data : null) ||
            'Could not save your information. Please try again.';
          alert(detail);
        }
        return;
      }

      const { addressId, contactId } = bookingData.userInfo
      if ([addressId, contactId].some((v) => !v)) {
        return
      }

      const payload = {
        contact:contactId,
        address:addressId,
        house_sqft: bookingData.userInfo?.selectedHouseSize,
        location: bookingData.userInfo?.locationId || undefined,
        first_time: bookingData.userInfo?.first_time? bookingData.userInfo?.first_time: false,
        quoted_by: (() => {
          // Ensure quoted_by is always sent as a number (employee ID)
          const quotedBy = bookingData.userInfo?.quoted_by;
          if (!quotedBy) return null;
          return typeof quotedBy === 'number' ? quotedBy : (typeof quotedBy === 'string' && !isNaN(Number(quotedBy)) ? Number(quotedBy) : null);
        })()
      }

      try {
        let submissionResponse
        if (submission_id) {
          submissionResponse = await updateSubmission({ id: submission_id, ...payload }).unwrap()
        } else {
          submissionResponse = await createSubmission(payload).unwrap()
          updateBookingData({
            submission_id: submissionResponse.submission_id,
          })
        }
        setActiveStep((prev) => prev + 1)
      } catch (err) {
        alert("Could not save contact. Please try again.")
      }
    } else if (activeStep === 1) {
      try {
        const hasServices = (bookingData.selectedServices?.length ?? 0) > 0;
        const hasCustomProducts = (bookingData.selectedCustomProducts?.length ?? 0) > 0;

        // Always call API (if services exist, send them; otherwise send empty array)
        const payload = {
          service_ids: hasServices
            ? bookingData.selectedServices.map(service => service.id)
            : [],
        };

        await addServiceToSubmission({
          submissionId: bookingData.submission_id,
          payload,
        });

        if (hasCustomProducts && !hasServices) {
          // Only custom products → jump to step 3
          const result = await submitOnlyCustomProducts(bookingData.submission_id).unwrap();
          setActiveStep(3);
        } else {
          // Either services only OR both services + custom products → normal flow
          setActiveStep(prev => prev + 1);
        }
      } catch (error) {
        // Error handled
      }
    }
    else if (activeStep === 2) {
      // Handle question responses submission
      try {
        const { submission_id, selectedServices, questionAnswers } = bookingData;
        
        if (!submission_id) {
          alert("Missing submission ID. Please go back and complete your information.");
          return;
        }

        // if (!selectedServices || selectedServices.length === 0) {
        //   alert("No services selected. Please go back and select services.");
        //   return;
        // }

        // Transform question answers to API format
        const serviceResponses = transformQuestionAnswersToAPIFormat(questionAnswers, selectedServices);

        // Submit responses for each service
        const responsePromises = selectedServices.map(async (service) => {
          const responses = serviceResponses[service.id] || [];
          
          if (responses.length === 0) {
            return;
          }

          const payload = { responses };
          
          try {
            const result = await createQuestionResponses({
              submissionId: submission_id,
              serviceId: service.id,
              payload
            }).unwrap();
            return result;
          } catch (error) {
            throw new Error(`Failed to submit responses for ${service.name}`);
          }
        });

        // Wait for all service responses to be submitted
        await Promise.all(responsePromises);
        
        setActiveStep((prev) => prev + 1);
        
      } catch (err) {
        alert(`Could not submit question responses: ${err.message || 'Please try again.'}`);
      }
    } else if (activeStep === 3) {
      // Image upload step - images are optional, so we can proceed without validation
      // The ImageUploadForm handles its own uploads
      setActiveStep((prev) => prev + 1);
    } else if (activeStep === steps.length - 1) {
      await handleSubmit()
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleSubmit = async () => {
    try {
      const { submission_id, selectedPackages, quoteDetails, selectedCustomProducts } = bookingData;
      
      if (!submission_id) {
        alert("Missing submission ID.");
        return;
      }

      if (
        (!selectedPackages || selectedPackages.length === 0) &&
        (!selectedCustomProducts || selectedCustomProducts.length === 0) &&
        (!selectedServices || selectedServices.length === 0)
      ) {
        alert("Please select at least one package, service, or custom product before submitting.");
        return;
      }

      // Prepare the payload for quote submission
      const payload = {
        customer_confirmation: true,
        selected_packages: selectedPackages?.map(pkg => ({
          service_selection_id: pkg.service_selection_id,
          package_id: pkg.package_id,
          package_name: pkg.package_name,
          total_price: pkg.total_price
        })),
        additional_notes: addiditional_notes,
        preferred_contact_method: "email",
        preferred_start_date: new Date().toISOString().split('T')[0],
        terms_accepted: termsAccepted,
        marketing_consent: false,
        signature: signature,
        signature_timestamp: signatureTimestamp || new Date().toISOString()
      };
      
      await submitQuote({ submissionId: submission_id, payload }).unwrap();

      // Submit replaces additional_data; put general notes back via the existing merge endpoint.
      if (!isPublicMode && (addiditional_notes || '').trim()) {
        await updateAdditionalData({
          submissionId: submission_id,
          payload: {
            additional_data: {
              customer_notes: addiditional_notes,
            },
          },
        }).unwrap();
      }
      
      localStorage.removeItem("bookingData");      // Navigate to success page or quote details
      navigate(buildQuoteDetailsHref(searchParams, submission_id, {
        first_name: quoteDetails?.contact?.first_name,
        last_name: quoteDetails?.contact?.last_name,
        email: quoteDetails?.contact?.email,
        phone: quoteDetails?.contact?.phone,
      }));
      
    } catch (err) {
      alert("Could not submit booking. Please try again.");
    }
  }

  const handleReset = () => {
    setActiveStep(0)
    setBookingData({
      submission_id: null,
      userInfo: {
        firstName: "",
        phone: "",
        email: "",
        address: "",
        latitude: "",
        longitude: "",
        googlePlaceId: "",
        contactId: null,
        selectedLocation: null,
        selectedHouseSize: null,
        locationId: null
      },
      selectedServices: [],
      selectedService: null,
      selectedPackage: null,
      questionAnswers: {},
      pricing: {
        basePrice: 0,
        tripSurcharge: 0,
        questionAdjustments: 0,
        totalPrice: 0,
      },
      quoteDetails: null,
      selectedPackages: [],
    });
  }

  const isStepComplete = (step) => {
    switch (step) {
      case 0: {
      const info = bookingData.userInfo || {};
      const isNonEmpty = (v) =>
        v !== null && v !== undefined && String(v).trim() !== "";

      if (isPublicMode) {
        return (
          isNonEmpty(info.firstName) &&
          isNonEmpty(info.email) &&
          isNonEmpty(info.phone) &&
          isNonEmpty(info.streetAddress) &&
          isNonEmpty(info.city) &&
          isNonEmpty(info.state) &&
          isNonEmpty(info.postalCode) &&
          isNonEmpty(info.selectedHouseSize)
        );
      }

      const {
        contactId = "",
        addressId = "",
        selectedHouseSize = ""
      } = info;

      return (
        isNonEmpty(contactId) &&
        isNonEmpty(addressId) &&  
        isNonEmpty(selectedHouseSize)
      );
    }
      case 1:
        return (
          (bookingData.selectedServices?.length ?? 0) > 0 ||
          (bookingData.selectedCustomProducts?.length ?? 0) > 0
        );
        // return true;
      case 2:
        return true; // Questions are optional, so always allow proceeding
      case 3:
        return true; // Image upload is optional, so always allow proceeding
      case 4:
        // Validate packages and services
        const hasCustom = bookingData.selectedCustomProducts?.length > 0;
        const servicesCount = bookingData.selectedServices?.length ?? 0;
        const packagesCount = bookingData.selectedPackages?.length ?? 0;

        const validSelection =
          // Case 1: custom only
          (hasCustom && servicesCount === 0) ||

          // Case 2: services with matching packages
          (servicesCount > 0 && servicesCount === packagesCount) ||

          // Case 3: custom + services (services must still match packages)
          (hasCustom && servicesCount > 0 && servicesCount === packagesCount);

        return validSelection && termsAccepted && Boolean(signature);

      default:
        return false
    }
  }

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return isPublicMode
          ? <PublicCustomerInfoForm data={bookingData} onUpdate={updateBookingData} />
          : <UserInfoForm data={bookingData} onUpdate={updateBookingData} />;
      case 1:
        return <MultiServiceSelectionForm data={bookingData} onUpdate={updateBookingData} isPublicMode={isPublicMode} />;
      case 2:
        return <QuestionsForm data={bookingData} onUpdate={updateBookingData} />;
      case 3:
        return (
          <ImageUploadForm 
            submissionId={bookingData.submission_id} 
            quotedBy={bookingData.userInfo?.quoted_by}
            quoteDetails={bookingData.quoteDetails}
            onQuoteDetailsUpdate={refetchQuoteDetails}
          />
        );
      case 4:
        return <CheckoutSummary data={bookingData} onUpdate={updateBookingData} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted}
        additionalNotes={addiditional_notes} setAdditionalNotes={setAdditionalNotes} setActiveStep={setActiveStep} handleSignatureEnd={handleSignatureEnd} setSignature={setSignature} signatureTimestamp={signatureTimestamp}
        isStepComplete={isStepComplete} handleNext={handleNext} signature={signature} setBookingData={setBookingData} initialBookingData={initialBookingData}
        isPublicMode={isPublicMode}
        />;
      default:
        return "Unknown step";
    }
  };

  const progressPercentage = ((activeStep + 1) / steps.length) * 100

  const handleSignatureEnd = (sigCanvasRef) => {
    if (sigCanvasRef.current) {
      try {
        // Fixed signature capture - use getCanvas() instead of getTrimmedCanvas()
        const canvas = sigCanvasRef.current.getCanvas()
        const dataUrl = canvas.toDataURL("image/png")

        // Convert to Base64 (remove data:image/png;base64, prefix for backend)
        const base64Data = dataUrl.split(",")[1]
        setSignature(base64Data)
        // Store timestamp when signature is captured
        setSignatureTimestamp(new Date().toISOString())
      } catch (error) {
        // Fallback: try to get data URL directly
        try {
          const dataUrl = sigCanvasRef.current.toDataURL("image/png")
          const base64Data = dataUrl.split(",")[1]
          setSignature(base64Data)
          // Store timestamp when signature is captured
          setSignatureTimestamp(new Date().toISOString())
        } catch (fallbackError) {
          // Fallback signature capture failed
        }
      }
    }
  }

  return (
    <div
      className={
        isPublicMode
          ? 'min-h-screen relative bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#fafaf9_45%,_#f5f5f4_100%)]'
          : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative'
      }
    >
      {!isPublicMode && <TenantModuleSwitcher />}
      {/* Header */}
      <div
        className={
          isPublicMode
            ? 'bg-white/90 backdrop-blur border-b border-stone-200/80 shadow-sm'
            : 'bg-white border-b border-gray-200 shadow-sm'
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="text-center sm:text-left flex-1">
            {isPublicMode && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 mb-1.5">
                Customer estimate
              </p>
            )}
            <h1
              className={
                isPublicMode
                  ? 'text-3xl sm:text-4xl font-bold text-teal-950 mb-2 tracking-tight'
                  : 'text-3xl font-bold text-gray-900 mb-2'
              }
            >
              {isPublicMode ? 'Get Your Free Estimate' : 'Create Your Quote'}
            </h1>
            <p className={isPublicMode ? 'text-stone-600 max-w-xl' : 'text-gray-600'}>
              {isPublicMode
                ? 'A few quick steps — your info, services, and questions — and we will build your estimate.'
                : 'Complete the steps below to create your quote'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className={
                isPublicMode
                  ? 'border-teal-700 text-teal-800 hover:text-teal-900 hover:bg-teal-50 rounded-xl text-sm px-3 py-2'
                  : 'border-blue-600 text-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-sm px-3 py-2'
              }
              onClick={() => {
                localStorage.removeItem("bookingData");
                setBookingData(initialBookingData);
                setActiveStep(0);
              }}
            >
              <PostAdd className="w-5 h-5 mr-1" />
              <span className="hidden sm:inline">Start a new quote</span>
            </Button>

            {!isPublicMode && isLoggedIn && (
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-sm px-3 py-2"
                onClick={() => navigate(`/admin/services?email=${paramEmail}`)}
              >
                <AdminPanelSettings className="w-5 h-5 mr-1" />
                <span className="hidden sm:inline">Switch to Admin</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-8 ${isPublicMode ? 'max-w-5xl' : ''}`}>
        {/* Progress Section */}
        <Card
          className={
            isPublicMode
              ? 'mb-8 shadow-md border border-stone-200/80 bg-white/95 rounded-2xl'
              : 'mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm'
          }
        >
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isPublicMode ? 'text-stone-600' : 'text-gray-700'}`}>
                  Step {activeStep + 1} of {steps.length}
                </span>
                <span className={`text-sm font-medium ${isPublicMode ? 'text-teal-800' : 'text-gray-700'}`}>
                  {Math.round(progressPercentage)}% Complete
                </span>
              </div>
              <Progress
                value={progressPercentage}
                className={`h-2 ${isPublicMode ? '[&>div]:bg-teal-600 bg-stone-100' : ''}`}
              />
            </div>

            <div className="flex justify-between items-center">
              {steps.map((label, index) => (
                <div key={label} className="flex flex-col items-center space-y-2">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
                      isPublicMode
                        ? index < activeStep
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : index === activeStep
                            ? 'bg-teal-700 border-teal-700 text-white shadow-md shadow-teal-700/25'
                            : 'bg-stone-50 border-stone-300 text-stone-400'
                        : index < activeStep
                          ? 'bg-gray-500 border-gray-500 text-white'
                          : index === activeStep
                            ? 'bg-gray-500 border-gray-500 text-white'
                            : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {index < activeStep || activeStep === steps.length - 1 ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </div>
                  <span
                    className={`text-xs font-medium text-center max-w-20 ${
                      index <= activeStep
                        ? isPublicMode ? 'text-teal-950' : 'text-gray-900'
                        : isPublicMode ? 'text-stone-400' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card
          className={
            isPublicMode
              ? 'shadow-lg border border-stone-200/80 bg-white rounded-2xl'
              : 'shadow-xl border-0 bg-white/90 backdrop-blur-sm'
          }
        >
          <CardContent sx={{ p: { xs: '0.4rem', sm: '1.5rem', md: '2rem' } }}>
            <div className="min-h-[500px]">{getStepContent(activeStep)}</div>

            <div className={`grid grid-cols-3 items-center pt-8 mt-8 border-t ${isPublicMode ? 'border-stone-200' : 'border-gray-200'}`}>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={activeStep === 0}
                className={`px-6 bg-transparent justify-self-start ${isPublicMode ? 'rounded-xl border-stone-300 text-stone-700' : ''}`}
              >
                Back
              </Button>

              <div className="justify-self-center">
                <PoweredBy locationId={brandingLocationId} />
              </div>

              <div className="flex items-center justify-end w-full gap-3">
                {activeStep !== steps.length - 1 &&
                  <Button
                    onClick={handleNext}
                    disabled={!isStepComplete(activeStep) || isSavingContact || submittingResponses || creatingQuote || submittingQuote}
                    className={
                      isPublicMode
                        ? 'px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20'
                        : 'px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }
                  >
                    {(isSavingContact || submittingResponses || creatingQuote) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {activeStep === 0 ? "Saving..." : 
                        activeStep === 1 ? "Adding Services..." :
                        activeStep === 2 ? "Submitting Responses..." :
                        activeStep === 3 ? "Processing..." :
                        "Submitting Quote..."}
                      </>
                    ) :(
                      "Next"
                    )}
                  </Button>
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default BookingWizard