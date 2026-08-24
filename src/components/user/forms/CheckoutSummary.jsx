import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import PoweredBy from '../../PoweredBy';
import CompanyLogo from '../../CompanyLogo';
import { useAccountBranding } from '../../../hooks/useAccountBranding';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Grid,
  Button,
  Radio,
  FormControlLabel,
  RadioGroup,
  FormControl,
  TextField,
  Checkbox,
  Container,
  CircularProgress,
  Chip,
  Collapse,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Snackbar,
  Alert,
  AlertTitle,
  Select,
  MenuItem,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import {
  Check,
  Close,
  ExpandMore,
  ExpandLess,
  Add,
  Remove,
  Edit,
  Delete,
  DeleteForever,
  Lock,
  LockOpen,
  PictureAsPdf,
  History,
} from '@mui/icons-material';
import { useCalculatePriceMutation } from '../../../store/api/user/priceApi';
import { useCreateCustomProductMutation, useDeleteCustomProductMutation, useGetQuoteDetailsQuery, useUpdateCustomProductMutation, useDeleteServiceMutation, useGetGlobalPriceQuery, useRejectQuoteMutation, useUpdateAdditionalDataMutation, usePersistQuoteSnapshotMutation } from '../../../store/api/user/quoteApi';
import { useGetContactReferralCreditQuery } from '../../../store/api/referralsApi';
import SignatureCanvas from 'react-signature-canvas';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { handleDownloadPDF } from '../../../utils/handleDownloadPDF';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation, Pagination, Virtual } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/pagination';

const mapToSelectedService = (serviceSelection, index = 0) => ({
  id: serviceSelection.service_details?.id,
  name: serviceSelection.service_details?.name,
  description: serviceSelection.service_details?.description,
  order: index, // preserve order or set to 0 if not needed
});


const calculateTotalSelectedPrice = (selectedPackages, quoteData) => {
    let total = 0;
    Object.entries(selectedPackages).forEach(([serviceId, packageId]) => {
      const serviceSelection = quoteData?.service_selections.find((s) => s.id === serviceId);
      const packageDetails = serviceSelection?.package_quotes.find((p) => p.id === packageId);
      if (packageDetails) {
        total += parseFloat(packageDetails.total_price || 0);
      }
    });
    return total;
  };

  const calculateCustomProductsTotal = (customProducts) => {
    return customProducts.reduce((total, product) => {
      return total + parseFloat(product.price || 0);
    }, 0);
  };

export const CheckoutSummary = ({ data, onUpdate = () => {}, termsAccepted, setTermsAccepted, additionalNotes, setAdditionalNotes, handleSignatureEnd, setSignature, signatureTimestamp, isStepComplete, handleNext, setActiveStep, setBookingData, initialBookingData, readOnly = false, isPublicMode = false }) => {
  const { profile, locationId, formatPrice } = useAccountBranding();
  const termsHref = locationId
    ? `/terms?location_id=${encodeURIComponent(locationId)}`
    : '/terms';
  const quoteDetailsHref = (submissionId) => {
    const base = `/quote/details/${submissionId}`;
    return locationId
      ? `${base}?location_id=${encodeURIComponent(locationId)}`
      : base;
  };
  const [selectedPackages, setSelectedPackages] = useState({});
  const [expandedServices, setExpandedServices] = useState({});
  const [customProducts, setCustomProducts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteServiceDialogOpen, setDeleteServiceDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejectionErrors, setRejectionErrors] = useState({});
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    description: '',
    price: '',
  });
  const [editMode, setEditMode] = useState(false);
  const [currentProductId, setCurrentProductId] = useState(null);

  const [basePriceApplied, setBasePriceApplied] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lockNotesDialogOpen, setLockNotesDialogOpen] = useState(false);
  const [showLockButton, setShowLockButton] = useState(false);
  const [isLockingNotes, setIsLockingNotes] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPersistingSnapshot, setIsPersistingSnapshot] = useState(false);
  const [persistedSnapshotId, setPersistedSnapshotId] = useState(null);

  const [searchParams] = useSearchParams();
  const submissionIdFromUrl = searchParams.get("submission_id");

  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useGetQuoteDetailsQuery(data.submission_id, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [createCustomProduct, { isLoading: isCreating }] = useCreateCustomProductMutation();
  const [updateCustomProduct] = useUpdateCustomProductMutation();
  const [deleteCustomProduct] = useDeleteCustomProductMutation();
  const [deleteService, { isLoading: isDeleting }] = useDeleteServiceMutation();
  const [rejectQuote, { isLoading: isRejecting }] = useRejectQuoteMutation();
  const [updateAdditionalData] = useUpdateAdditionalDataMutation();
  const [persistQuoteSnapshot] = usePersistQuoteSnapshotMutation();

  const sigCanvasRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const notesTextareaRef = useRef(null);

  const quoteData = useMemo(() => response, [response]);
  const isEditable = !readOnly && !quoteData?.is_persisted_snapshot;
  const quoteContactId = quoteData?.contact?.id || data?.userInfo?.contactId || null;
  const originalProposalHref = (snapshotId) => {
    const base = `/quote/original/${snapshotId}`;
    return locationId ? `${base}?location_id=${encodeURIComponent(locationId)}` : base;
  };
  const quoteImages = useMemo(() => {
    if (!Array.isArray(response?.images)) return [];
    return response.images.filter((img) => img?.image_url || img?.ghl_file_url || img?.image);
  }, [response?.images]);

  const [finalTotal, setFinalTotal] = useState();
  const { data: globalPriceData } = useGetGlobalPriceQuery();

  // useEffect(()=>{
  //   console.log(quoteData, 'data', data)
  //   if (!quoteData) return;
  //     const updatedServices = quoteData.service_selections.filter((s)=>s.id!==serviceToDelete?.service)

  //     console.log(quoteData.service_selections.filter((s)=>s.id!==serviceToDelete.service), 'dddiiii')

  //     onUpdate({
  //       selectedServices: updatedServices
  //     });
  //   }, [quoteData])

  console.log(selectedPackages, 'oaa')

  useEffect(() => {
    if (readOnly) return;
    onUpdate({selectedPackages:[]})
  }, []);



  useEffect(() => {
    if (!quoteData) return;

    const totalSelectedPrice = calculateTotalSelectedPrice(selectedPackages, quoteData);
    const customProductsTotal = calculateCustomProductsTotal(customProducts.filter((p)=>p.is_active===true));
    const surcharge = quoteData.total_surcharges ? parseFloat(quoteData.total_surcharges) : 0;

    const total = totalSelectedPrice + customProductsTotal + surcharge;
    const globalBase = parseFloat(globalPriceData?.base_price || 0);

    // ✅ Check if all services have a package selected
    const allPackagesSelected =
      quoteData?.service_selections?.length > 0 &&
      quoteData.service_selections.every(
        (s) => selectedPackages[s.id] !== undefined
      );

    if (allPackagesSelected) {
      if (total < globalBase) {
        setBasePriceApplied(true);
        setFinalTotal(globalBase);
      } else {
        setBasePriceApplied(false);
        setFinalTotal(total);
      }
    } else {
      setBasePriceApplied(false);
      setFinalTotal(total);
    }
  }, [selectedPackages, customProducts, quoteData, globalPriceData]);

  const { data: referralCredit } = useGetContactReferralCreditQuery(quoteContactId, {
    skip: !quoteContactId || isPublicMode,
  });
  const availableReferralDollars = Number(referralCredit?.available_credit_dollars || 0);
  const showReferralCredit =
    Boolean(quoteContactId) &&
    !isPublicMode &&
    Boolean(referralCredit?.program_enabled) &&
    availableReferralDollars > 0;
  const estimatedAfterReferral =
    showReferralCredit && finalTotal != null && !Number.isNaN(Number(finalTotal))
      ? Math.max(0, Number(finalTotal) - availableReferralDollars)
      : null;

  // Friend referral discount (referred customer's first job) — from quote details
  const referralDiscountInfo = quoteData?.referral_discount || null;
  const referralDiscountDollars = Number(referralDiscountInfo?.discount_dollars || 0);
  const showReferralDiscount = Boolean(referralDiscountInfo) && referralDiscountDollars > 0;
  const estimatedAfterReferralDiscount =
    showReferralDiscount && finalTotal != null && !Number.isNaN(Number(finalTotal))
      ? Math.max(0, Number(finalTotal) - referralDiscountDollars)
      : null;

  const surchargeAmount = quoteData?.total_surcharges


  // Initialize selected packages from saved quote data (read-only / reload flows)
  useEffect(() => {
    if (!quoteData?.service_selections) return;
    const fromDb = {};
    quoteData.service_selections.forEach((sel) => {
      const selected = sel.package_quotes?.find((p) => p.is_selected);
      if (selected) fromDb[sel.id] = selected.id;
    });
    if (Object.keys(fromDb).length > 0) {
      setSelectedPackages(fromDb);
    }
  }, [quoteData]);

  useEffect(() => {
    if (quoteData?.persisted_snapshot_id) {
      setPersistedSnapshotId(quoteData.persisted_snapshot_id);
    }
  }, [quoteData?.persisted_snapshot_id]);

  // Expand all services by default
  useEffect(() => {
    if (quoteData?.service_selections) {
      const initialExpanded = {};
      quoteData.service_selections.forEach((service) => {
        initialExpanded[service.id] = true;
      });
      setExpandedServices(initialExpanded);
    }
  }, [quoteData]);

  useEffect(() => {
    if (quoteData && !isLoading) {
      console.log(quoteData, 'datad')
      onUpdate({
        quoteDetails: quoteData,
        selectedCustomProducts: quoteData?.custom_products.filter((p) => p.is_active),
        pricing: {
          basePrice: parseFloat(quoteData.total_base_price || 0),
          totalAdjustments: parseFloat(quoteData.total_adjustments || 0),
          totalSurcharges: parseFloat(quoteData.total_surcharges || 0),
          finalTotal: parseFloat(quoteData.final_total || 0),
        },
      });
    }
  }, [quoteData, isLoading, data.quoteDetails, onUpdate]);

  useEffect(() => {
    if (isPublicMode) {
      setCustomProducts([]);
      return;
    }
    if (quoteData?.custom_products) {
      setCustomProducts(quoteData.custom_products);
    }
  }, [quoteData, isPublicMode]);

  // Load additional notes from quoteData when it's available (only if not already set)
  useEffect(() => {
    if (quoteData?.additional_data?.additional_notes !== undefined && 
        (!additionalNotes || additionalNotes === '')) {
      setAdditionalNotes(quoteData.additional_data.additional_notes || '');
    }
  }, [quoteData?.additional_data?.additional_notes]);

  // Check if notes are submitted (read-only)
  const isNotesSubmitted = readOnly || quoteData?.is_persisted_snapshot || quoteData?.additional_data?.is_submitted === true;

  // Reset lock button visibility when notes are already submitted
  // Also show lock button if notes exist but aren't locked yet
  useEffect(() => {
    if (isNotesSubmitted) {
      setShowLockButton(false);
    } else if (additionalNotes && additionalNotes.trim().length > 0 && quoteData?.additional_data?.additional_notes) {
      // Show lock button if notes exist in the database (have been saved before)
      setShowLockButton(true);
    }
  }, [isNotesSubmitted, additionalNotes, quoteData?.additional_data?.additional_notes]);

  const toggleServiceExpansion = (serviceId) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const toTitleCase = (str) => {
    if (!str) return ""
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    // Access the textarea element through the ref
    const textarea = notesTextareaRef.current;
    if (textarea && textarea.tagName === 'TEXTAREA') {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Calculate new height based on content
      const minHeight = 80; // Minimum height in pixels (approximately 3 rows)
      const maxHeight = 300; // Maximum height in pixels
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      // Show scrollbar if content exceeds max height
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  // Adjust textarea height when content changes
  useEffect(() => {
    // Use a small timeout to ensure DOM is updated
    const timer = setTimeout(() => {
      adjustTextareaHeight();
    }, 0);
    return () => clearTimeout(timer);
  }, [additionalNotes, adjustTextareaHeight]);

  // Auto-save additional notes with debouncing
  const autoSaveAdditionalNotes = useCallback((notes) => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Only auto-save if submission_id exists and notes are not submitted
    if (!data.submission_id || isNotesSubmitted) {
      return;
    }

    // Set new timeout for debounced save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsSavingNotes(true);
      try {
        await updateAdditionalData({
          submissionId: data.submission_id,
          payload: {
            additional_data: {
              additional_notes: notes || '',
            },
          },
        }).unwrap();
        // Show success toast
        setToastMessage('Additional notes saved successfully');
        setToastOpen(true);
        // Show lock button after successful save (only if not already submitted)
        if (!isNotesSubmitted && notes && notes.trim().length > 0) {
          setShowLockButton(true);
        }
      } catch (error) {
        console.error('Failed to auto-save additional notes:', error);
        // Show error toast
        setToastMessage('Failed to save additional notes. Please try again.');
        setToastOpen(true);
      } finally {
        setIsSavingNotes(false);
      }
    }, 1000); // Wait 1 second after user stops typing
  }, [data.submission_id, updateAdditionalData, isNotesSubmitted]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Permanently lock notes (set is_submitted to true)
  const handleLockNotes = async () => {
    if (!data.submission_id || !additionalNotes || additionalNotes.trim().length === 0) {
      return;
    }

    setIsLockingNotes(true);
    try {
      await updateAdditionalData({
        submissionId: data.submission_id,
        payload: {
          additional_data: {
            additional_notes: additionalNotes,
            is_submitted: true,
          },
        },
      }).unwrap();
      
      // Close dialog and hide lock button
      setLockNotesDialogOpen(false);
      setShowLockButton(false);
      
      // Show success toast
      setToastMessage('Additional notes have been permanently saved and locked');
      setToastOpen(true);
      
      // Refetch quote data to update the UI
      refetch();
    } catch (error) {
      console.error('Failed to lock additional notes:', error);
      setToastMessage('Failed to lock additional notes. Please try again.');
      setToastOpen(true);
    } finally {
      setIsLockingNotes(false);
    }
  };

  const handlePersistSnapshot = async () => {
    if (!data.submission_id || persistedSnapshotId) return;
    setIsPersistingSnapshot(true);
    try {
      const result = await persistQuoteSnapshot(data.submission_id).unwrap();
      const snapshotId = result.snapshot_id;
      setPersistedSnapshotId(snapshotId);
      setToastMessage(result.created ? 'Original proposal saved successfully.' : 'Original proposal was already saved.');
      setToastOpen(true);
      refetch();
    } catch (error) {
      console.error('Failed to save original proposal:', error);
      setToastMessage('Failed to save original proposal. Please try again.');
      setToastOpen(true);
    } finally {
      setIsPersistingSnapshot(false);
    }
  };

  const handlePackageSelect = (serviceSelectionId, packageQuote) => {
    if (!isEditable) return;
    const newSelected = {
      ...selectedPackages,
      [serviceSelectionId]: packageQuote.id,
    };

    setSelectedPackages(newSelected);

    const selectedPackagesArray = Object.entries(newSelected)
      .map(([serviceId, packageId]) => {
        const serviceSelection = quoteData?.service_selections.find((s) => s.id === serviceId);
        const packageDetails = serviceSelection?.package_quotes.find((p) => p.id === packageId);
        if (packageDetails && serviceSelection) {
          return {
            service_selection_id: serviceId,
            package_id: packageDetails.package,
            package_quote_id:packageDetails.id,
            package_name: packageDetails.package_name,
            total_price: packageDetails.total_price,
          };
        }
        return null;
      })
      .filter(Boolean);

    onUpdate({
      selectedPackages: selectedPackagesArray,
    });
  };

  const handleDeleteServiceClick = (service) => {
    setServiceToDelete(service);
    setDeleteServiceDialogOpen(true);
  };

  const handleDeleteServiceConfirm = async () => {
    if (!serviceToDelete) return;

    try {
      await deleteService({
        id: data.submission_id,
        serviceId: serviceToDelete.service,
      }).unwrap();

      // Update selected packages
      const newSelectedPackages = { ...selectedPackages };
      delete newSelectedPackages[serviceToDelete.id]; 
      if(submissionIdFromUrl){
        setSelectedPackages([]);
      }else{
        setSelectedPackages(newSelectedPackages);
      }

      // Filter services at the raw level (quoteData)
      const updatedServiceSelections = quoteData?.service_selections.filter(
        (s) => s.service !== serviceToDelete.service
      );

      // Map raw services → frontend simplified format
      const updatedServices = updatedServiceSelections.map((s, index) =>
        mapToSelectedService(s, index)
      );

      // Prepare selectedPackagesArray
      const selectedPackagesArray = Object.entries(newSelectedPackages)
        .map(([selectionId, packageId]) => {
          const serviceSelection = updatedServiceSelections.find(
            (s) => s.id === selectionId
          );
          const packageDetails = serviceSelection?.package_quotes.find(
            (p) => p.id === packageId
          );
          if (packageDetails && serviceSelection) {
            return {
              service_selection_id: selectionId,
              package_id: packageDetails.package,
              package_name: packageDetails.package_name,
              total_price: packageDetails.total_price,
            };
          }
          return null;
        })
        .filter(Boolean);

      onUpdate({
        selectedPackages: selectedPackagesArray,
        selectedServices: updatedServices,
      });

      setDeleteServiceDialogOpen(false);
      setServiceToDelete(null);
    } catch (err) {
      console.error("Failed to delete service", err);
    }
  };

  const handleAddOrUpdateCustomProduct = async () => {
    const productPayload = {
      purchase: data.submission_id,
      product_name: newProduct.product_name,
      description: newProduct.description,
      price: parseFloat(newProduct.price || 0),
    };

    try {
      if (editMode && currentProductId) {
        const updated = await updateCustomProduct({ id: currentProductId, ...productPayload }).unwrap();
        const updatedList = customProducts.map((p) => (p.id === currentProductId ? updated : p));
        setCustomProducts(updatedList);
        onUpdate({ selectedPackages, customProducts: updatedList });
      } else {
        const created = await createCustomProduct(productPayload).unwrap();
        const updatedList = [...customProducts, created];
        setCustomProducts(updatedList);
        onUpdate({ selectedPackages, customProducts: updatedList });
      }

      setDialogOpen(false);
      setEditMode(false);
      setCurrentProductId(null);
      setNewProduct({ product_name: '', description: '', price: '' });
    } catch (err) {
      console.error("Failed to save custom product", err);
    }
  };

  const handleDeleteCustomProduct = async (id) => {
    try {
      await deleteCustomProduct(id).unwrap();
      const updatedList = customProducts.filter((p) => p.id !== id);
      setCustomProducts(updatedList);
      onUpdate({ selectedPackages, customProducts: updatedList });
    } catch (err) {
      console.error("Failed to delete custom product", err);
    }
  };

  const handleToggleCustomProduct = async (product) => {
    try {
      const updated = await updateCustomProduct({
        id: product.id,
        is_active: !product.is_active, // toggle
      }).unwrap();

      // Build the new array first
      const updatedList = customProducts.map((p) =>
        p.id === product.id ? { ...p, is_active: updated.is_active } : p
      );

      // Update state
      setCustomProducts(updatedList);

      // Notify parent with the new list
      onUpdate({
        selectedCustomProducts: updatedList.filter((p) => p.is_active),
      });
    } catch (error) {
      console.error("Failed to update custom product:", error);
    }
  };


  const openEditDialog = (product) => {
    setEditMode(true);
    setCurrentProductId(product.id);
    setNewProduct({
      product_name: product.product_name,
      description: product.description,
      price: product.price,
    });
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: '#023c8f' }} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading quote details...
        </Typography>
      </Box>
    );
  }

  if (isError || !quoteData) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load quote details
        </Typography>
        <Typography color="text.secondary">Please refresh and try again.</Typography>
      </Box>
    );
  }

  const renderQuestionResponse = (response) => {
    switch (response.question_type) {
      case "yes_no":
      case "conditional":
        return response.yes_no_answer ? "Yes" : "No";
      case "multiple_yes_no":
        return (
          response.sub_question_responses
            .filter((sub) => sub.answer)
            .map((sub) => sub.sub_question_text)
            .join(", ") || "None selected"
        );
      case "quantity":
        return response.option_responses.map((opt) => `${opt.option_text}: ${opt.quantity}`).join(", ");
      case "describe":
        return response.option_responses.map((opt) => opt.option_text).join(", ");
      default:
        return "N/A";
    }
  };

  const {
    contact,
    address,
    house_sqft,
    service_selections,
    additional_data,
    custom_products,
    custom_service_total,
    quote_schedule,
  } = quoteData;

  return (
    <Box>
      <Container maxWidth="lg" sx={{p:"0rem"}}>
        {readOnly && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>Original Proposal — Saved Copy</AlertTitle>
            This is the technician&apos;s saved version of the quote. It stays unchanged even if the client edits their copy.
            {quoteData?.source_submission_id && (
              <Box mt={1}>
                <Button
                  component={Link}
                  size="small"
                  variant="outlined"
                  to={locationId
                    ? `/booking?submission_id=${quoteData.source_submission_id}&location_id=${encodeURIComponent(locationId)}`
                    : `/booking?submission_id=${quoteData.source_submission_id}`}
                  sx={{ textTransform: 'none', borderColor: '#023c8f', color: '#023c8f' }}
                >
                  View Current Client Quote
                </Button>
              </Box>
            )}
          </Alert>
        )}
        {/* Quote Header */}
        <Box mb={4}>
          <Box display="flex" justifyContent="center">
            <CompanyLogo locationId={locationId} />
          </Box>
          <Typography variant="h4" gutterBottom fontWeight={300} sx={{ color: '#023c8f', textAlign: 'center', fontSize:{ xs: "1.8rem", sm: "1.9rem", md: "2.2rem"} }}>
            {readOnly ? 'Original Proposal' : 'Quote Summary'}
          </Typography>
          {window.self !== window.top && (
            <Box textAlign="center">
                <Button
                  size="medium"
                  variant="outlined"
                  sx={{
                    borderColor: "#023c8f",
                    color: "#023c8f",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": { 
                      borderColor: "#023c8f", 
                      backgroundColor: "#e6f0ff",
                      boxShadow: "0 2px 6px rgba(0, 60, 143, 0.2)"
                    }
                  }}
                  onClick={() => {
                    setBookingData(initialBookingData);
                    setActiveStep(0);
                    navigate(locationId ? `/booking?location_id=${encodeURIComponent(locationId)}` : '/booking');
                  }}
                >
                  + Create Another Quote
                </Button>
            </Box>
          )}
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" justifyContent="center">
            <Typography variant="body1" color="text.secondary" sx={{fontSize:{ xs: "0.8rem", sm: "0.9rem", md: "1rem"}}}>
              Quote #{quoteData.id}
            </Typography>
            <Chip
              label={quoteData.status.replace("_", " ").toUpperCase()}
              size="small"
              sx={{ bgcolor: "#d9edf7", color: "#023c8f", fontWeight: 600, fontSize:{ xs: "0.7rem", sm: "0.8rem", md: "0.8rem"} }}
            />
            <Typography variant="body2" color="text.secondary">
              {new Date(quoteData.created_at).toLocaleDateString()}
            </Typography>
            <Button
              variant="outlined"
              onClick={() =>
                handleDownloadPDF(
                  setIsGeneratingPDF,
                  quoteData,
                  contact,
                  address,
                  quote_schedule,
                  service_selections,
                  custom_products,
                  globalPriceData,
                  additional_data,
                  house_sqft,
                  profile,
                  locationId
                )
              }
              disabled={isGeneratingPDF}
              startIcon={
                isGeneratingPDF ? <CircularProgress size={16} /> : <PictureAsPdf />
              }
              sx={{
                borderColor: "#42bd3f",
                color: "#42bd3f",
                "&:hover": {
                  bgcolor: "rgba(66, 189, 63, 0.04)",
                  borderColor: "#42bd3f",
                },
                "& .pdf-btn-label": {
                  display: "none",
                  "@media (min-width:600px)": {
                    display: "inline",
                  },
                },
              }}
            >
              <span className="pdf-btn-label">
                {isGeneratingPDF ? "Generating..." : "Download PDF"}
              </span>
            </Button>
            {isEditable && (
              persistedSnapshotId ? (
                <Button
                  component={Link}
                  variant="outlined"
                  to={originalProposalHref(persistedSnapshotId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<History />}
                  sx={{
                    borderColor: "#023c8f",
                    color: "#023c8f",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": {
                      bgcolor: "rgba(2, 60, 143, 0.04)",
                      borderColor: "#023c8f",
                    },
                  }}
                >
                  View Original Proposal
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  onClick={handlePersistSnapshot}
                  disabled={isPersistingSnapshot}
                  startIcon={
                    isPersistingSnapshot ? <CircularProgress size={16} /> : <History />
                  }
                  sx={{
                    borderColor: "#023c8f",
                    color: "#023c8f",
                    fontWeight: 600,
                    textTransform: "none",
                    "&:hover": {
                      bgcolor: "rgba(2, 60, 143, 0.04)",
                      borderColor: "#023c8f",
                    },
                  }}
                >
                  {isPersistingSnapshot ? "Saving..." : "Save Original Proposal"}
                </Button>
              )
            )}
          </Box>
        </Box>

        {/* Customer Info */}
        <Card sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} paddingRight={2} textAlign="right">
            <PoweredBy variant="text" locationId={locationId} />
          </Grid>
          <CardContent sx={{ px: {xs:2, md:3}, py: 0.5 }}>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#023c8f', fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.5rem"} }}>
              Customer Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" sx={{fontSize:{ xs: ".8rem", sm: "1rem"}}}>{toTitleCase(quoteData.contact?.first_name) } { toTitleCase(quoteData?.contact?.last_name)}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" sx={{fontSize:{ xs: ".8rem", sm: "1rem"}}}>{quoteData.contact?.email}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1" sx={{fontSize:{ xs: ".8rem", sm: "1rem"}}}>{quoteData.contact?.phone}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  House sq ft
                </Typography>
                <Typography variant="body1" sx={{fontSize:{ xs: ".8rem", sm: "1rem"}}}>{quoteData.house_sqft} sq ft</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1" sx={{fontSize:{ xs: ".8rem", sm: "1rem"}}}>
                  {quoteData.address?.street_address}, {quoteData.address?.city}, {quoteData.address?.state}, {quoteData.address?.postal_code}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Service Selections */}
        {quoteData.service_selections.map((selection) => (
          <Card key={selection.id} sx={{ mb: 1.5 }}>
            {/* Service Header */}
            <Box
              sx={{
                px: {xs:2, md:3},
                py: 0.5,
                backgroundColor: '#023c8f',
                color: 'white',
                cursor: "pointer",
                "&:hover": { bgcolor: "#012a6b" },
              }}
              onClick={() => toggleServiceExpansion(selection.id)}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" 
              sx={{
                minHeight: { xs: 48, sm: 36 },
                gap: 1,
              }}>
                <Box>
                  <Typography fontWeight={600} 
                    sx={{ color: 'white', fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.5rem"},flex: 1,
                      whiteSpace: "normal",
                      wordBreak: "break-word"
                    }}>
                    {selection.service_details.name}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={{sx:0, md:1}}>
                  {isEditable && (
                  <IconButton 
                    sx={{ color: 'white', padding:0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteServiceClick(selection);
                    }}
                    title="Delete Service"
                  >
                    <DeleteForever sx={{fontSize: { xs: "1.125rem", sm: "1.5rem", lg: "1.625rem" }}}/>
                  </IconButton>
                  )}
                  <IconButton sx={{ color: 'white', padding:0 }}>
                    {expandedServices[selection.id] ? <ExpandLess sx={{fontSize: { xs: "1.125rem", sm: "1.5rem", lg: "1.625rem" }}}/> : <ExpandMore sx={{fontSize: { xs: "1.125rem", sm: "1.5rem", lg: "1.625rem" }}}/>}
                  </IconButton>
                </Box>
              </Box>
            </Box>

            {/* Collapsible Content */}
            <Collapse in={expandedServices[selection.id]} timeout="auto" unmountOnExit>
              <Box sx={{ px: {xs:1.5, md:3}, py: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: { xs: "0.75rem", sm: "0.875rem", md:'1rem' } }}>
                  {selection.service_details.description}
                </Typography>
                
                {/* Service Disclaimers */}
                {(selection.service_details.service_settings?.general_disclaimer || 
                  selection.service_details.service_settings?.bid_in_person_disclaimer) && (
                  <Box sx={{ mb: 2 }}>
                    {selection.service_details.service_settings?.general_disclaimer && (
                      <Box 
                        sx={{ 
                          backgroundColor: '#d9edf7',
                          padding: '12px 16px',
                          borderRadius: '6px',
                          mb: 1,
                          border: '1px solid #023c8f'
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#023c8f',
                            fontWeight: 500,
                            fontSize: '13px'
                          }}
                        >
                          <strong>General:</strong> {selection.service_details.service_settings.general_disclaimer}
                        </Typography>
                      </Box>
                    )}
                    
                    {selection.service_details.service_settings?.bid_in_person_disclaimer && (
                      <Box 
                        sx={{ 
                          backgroundColor: '#d9edf7',
                          padding: '12px 16px',
                          borderRadius: '6px',
                          mb: 1,
                          border: '1px solid #023c8f'
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#023c8f',
                            fontWeight: 500,
                            fontSize: '13px'
                          }}
                        >
                          <strong>Bid in Person:</strong> {selection.service_details.service_settings.bid_in_person_disclaimer}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Package Selection */}
                <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#023c8f',fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.3rem"} }}>
                  Select Package
                </Typography>
                <FormControl component="fieldset" fullWidth>
                  <Box
                    value={selectedPackages[selection.id] || ""}
                    onChange={(e) => {
                      const packageQuote = selection.package_quotes.find((p) => p.id === e.target.value);
                      if (packageQuote) {
                        handlePackageSelect(selection.id, packageQuote);
                      }
                    }}
                  >
                    <Swiper 
                      modules={[FreeMode, Pagination]} 
                      spaceBetween={10} 
                      slidesPerView={"auto"}
                      pagination={{
                        clickable: true,
                      }} 
                      freeMode={true}
                      style={{ margin:0 }}
                      breakpoints={{
                        768: {
                          spaceBetween: 20,
                        },
                      }}
                    >
                      {selection.package_quotes.map((packageQuote, index) => (
                        <SwiperSlide key={packageQuote.id} style={{ width: "auto" }}>
                            <Card
                              variant="outlined"
                              sx={{
                                cursor: isEditable ? "pointer" : "default",
                                border:
                                  selectedPackages[selection.id] === packageQuote.id
                                    ? "2px solid #42bd3f"
                                    : "1px solid #e0e0e0",
                                bgcolor:
                                  selectedPackages[selection.id] === packageQuote.id
                                    ? "#f8fff8"
                                    : "white",
                                "&:hover": isEditable ? { borderColor: "#42bd3f" } : {},
                                borderRadius: 3,
                                height:"100%",
                                width: "fit-content", // responsive height
                                flexShrink: 0,    
                                maxWidth: 280,
                                minWidth: 180,
                                minHeight: { xs: 180, sm: 200, md: 220 }, // responsive height
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                              }}
                              onClick={isEditable ? () => handlePackageSelect(selection.id, packageQuote) : undefined}
                            >
                              <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 },textAlign: "center", }}>
                                {/* Header */}
                                {/* <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}> */}
                                  <Typography
                                    variant="h6"
                                    fontWeight={700}
                                    sx={{ fontSize: { xs: "1rem", sm: "1.2rem", md: "1.6rem" } }}
                                  >
                                    {packageQuote.package_name}
                                  </Typography>
                                  {/* <FormControlLabel
                                    value={packageQuote.id}
                                    control={
                                      <Radio
                                        sx={{
                                          color: "#42bd3f",
                                          "&.Mui-checked": { color: "#42bd3f" },
                                        }}
                                      />
                                    }
                                    label=""
                                    sx={{ m: 0 }}
                                  /> */}
                                {/* </Box> */}

                                {/* Price */}
                                <Typography
                                  variant="h4"
                                  sx={{
                                    color: "#42bd3f",
                                    fontWeight: 700,
                                    mb: 2,
                                    fontSize: { xs: "1.5rem", sm: "1.8rem", md: "2rem" },
                                  }}
                                >
                                  {formatPrice(packageQuote.total_price)}
                                </Typography>

                                {/* Features List */}
                                <Box textAlign="left">
                                  {[
                                    ...(packageQuote.included_features_details || []).map((f) => ({
                                      ...f,
                                      included: true,
                                    })),
                                    ...(packageQuote.excluded_features_details || []).map((f) => ({
                                      ...f,
                                      included: false,
                                    })),
                                  ].map((feature) => (
                                    <Box key={feature.id} display="flex" alignItems="center" mb={0.8}>
                                      {feature.included ? (
                                        <Check sx={{ fontSize: { xs: 16, sm: 18 }, color: "#42bd3f", mr: 1 }} />
                                      ) : (
                                        <Close sx={{ fontSize: { xs: 16, sm: 18 }, color: "#9e9e9e", mr: 1 }} />
                                      )}
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: { xs: "0.75rem", sm: "0.85rem", md: "0.9rem" },
                                          color: feature.included ? "text.primary" : "text.disabled",
                                          fontWeight:500,
                                          overflowWrap: "break-word",
                                          wordWrap: "break-word",
                                          flexShrink: 1,           // allow shrinking inside flex
                                          minWidth: 0, 
                                        }}
                                      >
                                        {feature.name}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </CardContent>
                            </Card>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  </Box>
                </FormControl>

                {/* Question Responses */}
                {selection.question_responses?.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#023c8f", fontSize:{ xs: "1rem", sm: "1.2rem", md: "1.3rem"} }}>
                      Your Responses
                    </Typography>
                    <Box sx={{ bgcolor: "#f8f9fa", borderRadius: 1, p: 1 }}>
                      {selection.question_responses.map((response, index) => (
                        <Box key={response.id} sx={{ display: 'flex', mb: 0.5, alignItems: "flex-start"}}>
                            <Typography variant="body1" sx={{ color: "#023c8f", fontWeight: 600, mr: 1, minWidth: '25px', fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" }}}>
                              Q{index + 1}:
                            </Typography>
                          <Box >
                            <Typography variant="body1" sx={{ flex: 1, mr: 1, fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" }}}>
                              {response.question_text}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 'fit-content', pl:1, fontSize: { xs: "0.75rem", sm: "0.85rem", md: "1rem" }}}>
                              {renderQuestionResponse(response)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Card>
        ))}

        {/* Custom Products Section — technician only */}
        {!isPublicMode && customProducts.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#023c8f' }}>
                Custom Products
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Additional custom services added to your quote
              </Typography>
              <Grid container spacing={2}>
                {customProducts.map((product) => (
                  <Grid item xs={12} sm={6} md={4} key={product.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        border: product.is_active ? "2px solid #42bd3f" : "1px solid #e0e0e0",
                        bgcolor: product.is_active ? "#f8fff8" : "white",
                        borderRadius: 2,
                        height: "100%",
                        cursor: "pointer",
                        "&:hover": { borderColor: "#42bd3f" },
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                      onClick={() => handleToggleCustomProduct(product)}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} mb={2}>
                          <Typography variant="h6" fontWeight={600}>
                            {product.product_name}
                          </Typography>
                          <Box>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditDialog(product); }}>
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteCustomProduct(product.id); }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {product.description}
                        </Typography>
                        <Typography variant="h6" sx={{ color: "#42bd3f", fontWeight: 700 }}>
                          {formatPrice(product.price)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Add More Services Button */}
        {isEditable && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              sx={{
                color: '#023c8f',
                borderColor: '#023c8f',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                  borderColor: '#023c8f',
                },
                fontWeight: 600,
                minWidth: "200px",
              }}
              onClick={() => setActiveStep(1)}
            >
              Add More Services
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Uploaded Images */}
        {quoteImages.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ color: '#023c8f', fontSize: { xs: "1rem", sm: "1.2rem", md: "1.4rem" } }}
              >
                Uploaded Images
              </Typography>
              <Grid container spacing={1.5}>
                {quoteImages.map((img) => {
                  const imageSrc = img.image_url || img.ghl_file_url || img.image;
                  return (
                    <Grid item xs={6} sm={4} md={3} key={img.id}>
                      <Box
                        sx={{
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: '#f8f9fa',
                        }}
                      >
                        <Box
                          component="img"
                          src={imageSrc}
                          alt={img.caption || 'Uploaded image'}
                          sx={{
                            width: '100%',
                            height: { xs: 120, sm: 140, md: 160 },
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        {img.caption && (
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              p: 1,
                              color: 'text.secondary',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={img.caption}
                          >
                            {img.caption}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Additional Notes */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight={600} sx={{ color: isPublicMode ? '#0f766e' : '#023c8f' }}>
                  {isPublicMode ? 'Your Notes' : 'Additional Notes'}
                </Typography>
                {isNotesSubmitted && (
                  <Lock sx={{ color: '#666', fontSize: 18 }} />
                )}
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {isSavingNotes && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={16} sx={{ color: '#023c8f' }} />
                    <Typography variant="caption" sx={{ color: '#023c8f', fontSize: '0.75rem' }}>
                      Saving...
                    </Typography>
                  </Box>
                )}
                {showLockButton && !isNotesSubmitted && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Lock />}
                    onClick={() => setLockNotesDialogOpen(true)}
                    sx={{
                      color: '#023c8f',
                      borderColor: '#023c8f',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                        borderColor: '#023c8f',
                      },
                      fontSize: '0.75rem',
                      textTransform: 'none',
                      ml: 1,
                    }}
                  >
                    Lock Notes
                  </Button>
                )}
              </Box>
            </Box>
            <TextField
              inputRef={notesTextareaRef}
              placeholder="Share any special requests, instructions, or notes that will help us serve you better..."
              multiline
              fullWidth
              disabled={isNotesSubmitted}
              value={additionalNotes || ''}
              onChange={(e) => {
                if (isNotesSubmitted) return;
                const newValue = e.target.value;
                setAdditionalNotes(newValue);
                onUpdate({ additionalNotes: newValue, termsAccepted });
                // Auto-save with debouncing
                autoSaveAdditionalNotes(newValue);
                // Adjust height after state update
                setTimeout(adjustTextareaHeight, 0);
              }}
              onInput={(e) => {
                if (isNotesSubmitted) return;
                // Adjust height on input for immediate feedback
                adjustTextareaHeight();
              }}
              helperText={
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                  <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                    {isNotesSubmitted 
                      ? 'These notes are locked and cannot be edited' 
                      : 'Your notes are automatically saved'}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: (additionalNotes?.length || 0) > 1000 ? '#d32f2f' : '#666',
                      fontSize: '0.75rem',
                      fontWeight: (additionalNotes?.length || 0) > 1000 ? 600 : 400
                    }}
                  >
                    {(additionalNotes?.length || 0)} / 2000 characters
                  </Typography>
                </Box>
              }
              inputProps={{
                maxLength: 2000,
                readOnly: isNotesSubmitted,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  transition: 'all 0.2s ease-in-out',
                  '&:hover fieldset': {
                    borderColor: isNotesSubmitted ? '#e0e0e0' : '#023c8f',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: isNotesSubmitted ? '#e0e0e0' : '#023c8f',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#f5f5f5',
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                  },
                  '& textarea': {
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '80px !important',
                    lineHeight: '1.5',
                    padding: '14px',
                    cursor: isNotesSubmitted ? 'not-allowed' : 'text',
                  },
                },
                '& .MuiFormHelperText-root': {
                  marginLeft: 0,
                  marginRight: 0,
                },
              }}
            />
            {/* Warning message when notes are editable */}
            {!isNotesSubmitted && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mt: 2,
                  '& .MuiAlert-icon': {
                    color: '#ed6c02',
                  },
                  '& .MuiAlert-message': {
                    color: '#856404',
                    fontSize: '0.875rem',
                  }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                  ⚠️ Important Notice
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                The Note area is reserved for internal notes for employees and staff.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Quoted By */}
        {quoteData.quoted_by_details && (
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ px: 3, py: 2 }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#023c8f' }}>
                Quoted By
              </Typography>
              <Box
                sx={{
                  // border: '1px solid #e0e0e0',
                  // borderRadius: 1,
                  p: 2,
                  bgcolor: '#f8f9fa',
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 500, color: '#023c8f' }}>
                  {quoteData.quoted_by_details.full_name || `${quoteData.quoted_by_details.first_name || ""} ${quoteData.quoted_by_details.last_name || ""}`.trim()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#023c8f' }}>
              Order Summary
            </Typography>
            {quoteData?.service_selections?.length > 0 &&
            Object.keys(selectedPackages).length !== quoteData.service_selections.length && (
              <Box mb={2} p={2} sx={{ bgcolor: "#d9edf7", borderRadius: 1, textAlign: "center" }}>
                <Typography variant="body2" sx={{ color: '#023c8f' }}>
                  Almost there! Please select packages for all services you want to include, or remove any you don’t need to finalize your quote.
                </Typography>
              </Box>
            )}
            {Object.keys(selectedPackages).length > 0 ? (
              <Box mb={2}>
                {Object.entries(selectedPackages).map(([serviceId, packageId]) => {
                  const serviceSelection = quoteData?.service_selections.find((s) => s.id === serviceId);
                  const pkg = serviceSelection?.package_quotes.find((p) => p.id === packageId);
                  if (pkg && serviceSelection) {
                    return (
                      <Box key={serviceId} mb={1}>
                        <Box display="flex" justifyContent="space-between">
                          <Box>
                            <Typography variant="body1" fontWeight={500}>
                              {pkg.package_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {serviceSelection.service_details.name}
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight={600}>
                            {formatPrice(pkg.total_price)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }
                  return null;
                })}
              </Box>
            ) : data.selectedCustomProducts?.length > 0 ? null : (
                <Box mb={2} p={2} sx={{ bgcolor: "#d9edf7", borderRadius: 1, textAlign: "center" }}>
                  <Typography variant="body2" sx={{ color: '#023c8f' }}>
                    Please select a package above
                  </Typography>
                </Box>
            )}

            {/* Custom Products in Summary — technician only */}
            {!isPublicMode && customProducts.filter((p)=>p.is_active===true).length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#023c8f', mb: 1 }}>
                  Custom Products
                </Typography>
                {customProducts.filter((p)=>p.is_active===true).map((product) => (
                  <Box key={product.id} mb={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {product.product_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.description}
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight={600}>
                        {formatPrice(product.price)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {surchargeAmount > 0 && (
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Trip Surcharge</Typography>
                <Typography variant="body2">{formatPrice(surchargeAmount)}</Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="h6" fontWeight={700}>
                Subtotal
              </Typography>

              <Box textAlign="right">
                <Typography variant="h6" fontWeight={700} color="success.main">
                  {formatPrice(finalTotal)}
                </Typography>

                {basePriceApplied && (
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "warning.main", fontStyle: "italic", mt: 0.5 }}
                  >
                    Note: The total has been adjusted to meet base price of {formatPrice(globalPriceData?.base_price)}.
                  </Typography>
                )}
              </Box>
            </Box>

            {showReferralDiscount && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Referral Discount: -{formatPrice(referralDiscountDollars)}
                {referralDiscountInfo?.referrer_name && (
                  <> (thanks to {referralDiscountInfo.referrer_name}'s referral)</>
                )}
                .
                {estimatedAfterReferralDiscount != null && (
                  <> Your total after the referral discount: {formatPrice(estimatedAfterReferralDiscount)}.</>
                )}{' '}
                The discount is applied automatically on your job and invoice.
              </Alert>
            )}

            {showReferralCredit && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Referral credit available: {formatPrice(availableReferralDollars)}.
                {estimatedAfterReferral != null && (
                  <> Estimated after credit on a future invoice: {formatPrice(estimatedAfterReferral)}.</>
                )}{' '}
                Credit auto-applies when the job invoice is created (not deducted from this quote total).
              </Alert>
            )}

            {isEditable && (
            <>
            {/* Signature Section */}
            <Box sx={{ mb: 3, maxWidth: { xs: '100%', sm: '500px' } }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#023c8f', fontWeight: 600 }}>
                Signature
              </Typography>
              <Box
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  width: '100%',
                  height: { xs: 220, sm: 180, md: 200 },
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'crosshair',
                  '&:hover': {
                    borderColor: '#023c8f',
                  },
                }}
              >
                <Box sx={{ width: "100%", flex: 1, minHeight: 0 }}>
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{
                      className: "w-full h-full",
                    }}
                    onEnd={() => {handleSignatureEnd(sigCanvasRef)}}
                  />
                </Box>
                {/* Timestamp area at bottom of signature box */}
                <Box
                  sx={{
                    borderTop: '1px solid #e0e0e0',
                    px: 1.5,
                    py: 0.75,
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    Date: {new Date().toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    Time: {new Date().toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    color: '#023c8f',
                    borderColor: '#023c8f',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                      borderColor: '#023c8f',
                    },
                  }}
                  onClick={() => {
                    sigCanvasRef.current.clear();
                    setSignature('');
                  }}
                >
                  Clear
                </Button>
              </Box>
            </Box>

            <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      onUpdate({ additionalNotes, termsAccepted: e.target.checked });
                    }}
                    sx={{ 
                      color: '#e1e1e1', 
                      '&.Mui-checked': { color: '#023c8f' } 
                    }}
                  />
                }
                label={
                  <Typography variant="body2">I agree to the{" "}
                    <Link to={termsHref} target="_blank" rel="noopener noreferrer" style={{ color: "#023c8f", textDecoration: "underline" }}>
                      Terms & Conditions
                    </Link>
                  </Typography>
                }
                sx={{ flex: 1 }}
              />

              <Box display="flex" gap={2} flexDirection={{ xs: "column", sm: "row" }} width={{ xs: "100%", sm: "auto" }}>
                <Button
                  variant="outlined"
                  size="large"
                  disabled={isRejecting}
                  sx={{
                    borderColor: "#ef4444",
                    color: "#ef4444",
                    "&:hover": { 
                      borderColor: "#dc2626",
                      backgroundColor: "#fee2e2",
                    },
                    "&:disabled": { 
                      borderColor: "#e0e0e0",
                      color: "#e0e0e0"
                    },
                    fontWeight: 600,
                    minWidth: { xs: "100%", sm: "200px" },
                  }}
                  onClick={() => setRejectDialogOpen(true)}
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Quote'}
                </Button>

                <Button
                  variant="contained"
                  size="large"
                  disabled={
                    (
                      Object.keys(data.selectedPackages).length === 0 &&
                      (data.selectedServices?.length ?? 0) === 0 &&
                      (data.selectedCustomProducts?.length ?? 0) === 0
                    )
                    || !termsAccepted
                    || !isStepComplete(3)
                    ||
      (quoteData?.service_selections?.length !== Object.keys(data.selectedPackages).length)
                  }

                  sx={{
                    bgcolor: "#42bd3f",
                    "&:hover": { bgcolor: "#369932" },
                    "&:disabled": { bgcolor: "#e0e0e0" },
                    fontWeight: 600,
                    minWidth: { xs: "100%", sm: "200px" },
                  }}
                  onClick={handleNext}
                >
                  Accept Quote
                </Button>
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
              Final price confirmed after service completion
            </Typography>
            </>
            )}
          </CardContent>
        </Card>
      </Container>

      {/* Custom Product Dialog — technician only */}
      {!isPublicMode && (
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editMode ? 'Update' : 'Add'} Custom Product</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Product Name"
            fullWidth
            value={newProduct.product_name}
            onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            value={newProduct.description}
            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Price"
            type="number"
            fullWidth
            value={newProduct.price}
            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddOrUpdateCustomProduct}>
            {editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {/* Delete Service Confirmation Dialog */}
      <Dialog open={deleteServiceDialogOpen} onClose={() => setDeleteServiceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f' }}>
          <DeleteForever sx={{ color: '#d32f2f' }} />
          Delete Service
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete the service "{serviceToDelete?.service_details?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone. The service and all its associated data will be permanently removed from your quote.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setDeleteServiceDialogOpen(false)}
            sx={{ color: '#666' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleDeleteServiceConfirm}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <Delete />}
            sx={{
              bgcolor: '#d32f2f',
              '&:hover': { bgcolor: '#b71c1c' },
              '&:disabled': { bgcolor: '#ffcdd2' }
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Service'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Quote Confirmation Dialog */}
      <Dialog 
        open={rejectDialogOpen} 
        onClose={() => {
          if (!isRejecting) {
            setRejectDialogOpen(false);
            setRejectionReason('');
            setRejectionNotes('');
            setRejectionErrors({});
          }
        }} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: '#ef4444',
            pb: 1,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          <Close sx={{ color: '#ef4444', fontSize: 24 }} />
          <Typography variant="h6" component="span" fontWeight={600}>
            Reject Quote
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Typography variant="body1" gutterBottom sx={{ mb: 3, color: '#333' }}>
            We're sorry to see you go. Please help us understand why you're rejecting this quote so we can improve our service.
          </Typography>

          <FormControl 
            fullWidth 
            required 
            error={!!rejectionErrors.reason}
            sx={{ mb: 3 }}
          >
            <InputLabel id="rejection-reason-label" sx={{ color: '#666' }}>
              Reason for Rejection *
            </InputLabel>
            <Select
              labelId="rejection-reason-label"
              id="rejection-reason"
              value={rejectionReason}
              label="Reason for Rejection *"
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (rejectionErrors.reason) {
                  setRejectionErrors(prev => ({ ...prev, reason: '' }));
                }
              }}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e0e0e0',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#023c8f',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#023c8f',
                },
              }}
            >
              <MenuItem value="Price">Price</MenuItem>
              <MenuItem value="Timing">Timing</MenuItem>
              <MenuItem value="Chose another company">Chose another company</MenuItem>
              <MenuItem value="Not ready">Not ready</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
            {rejectionErrors.reason && (
              <FormHelperText>{rejectionErrors.reason}</FormHelperText>
            )}
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Additional Notes (Optional)"
            placeholder="Please provide any additional feedback that might help us improve..."
            value={rejectionNotes}
            onChange={(e) => {
              setRejectionNotes(e.target.value);
              if (rejectionErrors.notes) {
                setRejectionErrors(prev => ({ ...prev, notes: '' }));
              }
            }}
            error={!!rejectionErrors.notes}
            helperText={rejectionErrors.notes || 'Your feedback is valuable to us'}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#e0e0e0',
                },
                '&:hover fieldset': {
                  borderColor: '#023c8f',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#023c8f',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#666',
              },
            }}
          />

          <Box 
            sx={{ 
              bgcolor: '#fff3cd', 
              border: '1px solid #ffc107',
              borderRadius: 1,
              p: 2,
              mt: 2
            }}
          >
            <Typography variant="body2" sx={{ color: '#856404', fontSize: '0.875rem' }}>
              <strong>Note:</strong> This action will mark the quote as rejected. You will be redirected to the quote details page after confirmation.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button 
            onClick={() => {
              setRejectDialogOpen(false);
              setRejectionReason('');
              setRejectionNotes('');
              setRejectionErrors({});
            }}
            disabled={isRejecting}
            sx={{ 
              color: '#666',
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                bgcolor: '#f5f5f5'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              // Validate form
              const errors = {};
              if (!rejectionReason || rejectionReason.trim() === '') {
                errors.reason = 'Please select a reason for rejection';
              }
              
              if (Object.keys(errors).length > 0) {
                setRejectionErrors(errors);
                return;
              }

              try {
                await rejectQuote({
                  submissionId: data.submission_id,
                  payload: {
                    rejection_reason: rejectionReason,
                    rejection_notes: rejectionNotes.trim() || '',
                  }
                }).unwrap();
                
                // Reset form and close dialog
                setRejectionReason('');
                setRejectionNotes('');
                setRejectionErrors({});
                setRejectDialogOpen(false);
                
                // Navigate to quote details
                navigate(quoteDetailsHref(data.submission_id));
              } catch (error) {
                // Error handled by toast notification
                console.error('Failed to reject quote:', error);
              }
            }}
            disabled={isRejecting}
            startIcon={isRejecting ? <CircularProgress size={16} color="inherit" /> : <Close />}
            sx={{
              bgcolor: '#ef4444',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              '&:hover': { 
                bgcolor: '#dc2626',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              },
              '&:disabled': { 
                bgcolor: '#ffcdd2',
                color: '#fff'
              }
            }}
          >
            {isRejecting ? 'Rejecting...' : 'Reject Quote'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lock Notes Confirmation Dialog */}
      <Dialog 
        open={lockNotesDialogOpen} 
        onClose={() => {
          if (!isLockingNotes) {
            setLockNotesDialogOpen(false);
          }
        }} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: '#023c8f',
            pb: 1,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          <Lock sx={{ color: '#023c8f', fontSize: 24 }} />
          <Typography variant="h6" component="span" fontWeight={600}>
            Permanently Lock Additional Notes
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Typography variant="body1" gutterBottom sx={{ mb: 2, color: '#333' }}>
            Are you sure you want to permanently lock these additional notes?
          </Typography>
          <Box 
            sx={{ 
              bgcolor: '#fff3cd', 
              border: '1px solid #ffc107',
              borderRadius: 1,
              p: 2,
              mb: 2
            }}
          >
            <Typography variant="body2" sx={{ color: '#856404', fontSize: '0.875rem' }}>
              <strong>Important:</strong> Once locked, you will not be able to edit these notes. This action cannot be undone.
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem' }}>
            Your notes will be saved permanently and marked as submitted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
          <Button
            onClick={() => {
              if (!isLockingNotes) {
                setLockNotesDialogOpen(false);
              }
            }}
            disabled={isLockingNotes}
            sx={{
              color: '#666',
              '&:hover': {
                backgroundColor: '#f5f5f5',
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLockNotes}
            disabled={isLockingNotes}
            variant="contained"
            startIcon={isLockingNotes ? <CircularProgress size={16} /> : <Lock />}
            sx={{
              bgcolor: '#023c8f',
              '&:hover': { bgcolor: '#022d6f' },
              '&:disabled': { bgcolor: '#b0bec5' }
            }}
          >
            {isLockingNotes ? 'Locking...' : 'Lock Notes Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification for Additional Notes - Rendered via Portal */}
      {createPortal(
        <Snackbar
          open={toastOpen}
          autoHideDuration={3000}
          onClose={() => setToastOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            position: 'fixed',
            bottom: '24px !important',
            right: '24px !important',
            zIndex: 9999,
          }}
        >
          <Alert
            onClose={() => setToastOpen(false)}
            severity={toastMessage.includes('Failed') ? 'error' : 'success'}
            sx={{ width: '100%', minWidth: '300px' }}
          >
            {toastMessage}
          </Alert>
        </Snackbar>,
        document.body
      )}
    </Box>
  );
};

export default CheckoutSummary;