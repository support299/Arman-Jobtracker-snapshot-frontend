import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Card,
  CardContent,
  CardHeader,
  Badge,
  OutlinedInput,
  IconButton,
  Button,
} from "@mui/material";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, RotateCcw, Plus, XSquare } from "lucide-react";
import moment from "moment-timezone";
import { jobsApi, useUpdateJobMutation, useConvertJobToSeriesMutation, useSearchContactsQuery, useGetAddressesByContactQuery } from "../../../store/api/jobsApi";
import { useGetEmployeesQuery } from "../../../store/api/payrollApi";
import { JobTeamAssignmentField } from "./JobTeamAssignmentField";
import { useGetServicesQuery } from "../../../store/api/servicesApi";
import { useDispatch } from "react-redux";
import ContactSearchableSelect from "./ContactSearchableSelect";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { jobGrandTotalAmount, jobSurchargeAmount } from "../../../utils/jobPricing";
import { useAccountTimezone } from "@/hooks/useAccountTimezone";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";

export function EditJobDialog({
  job,
  open,
  onClose,
  objective,
  handleJobUpdate,
  accountTimezone: accountTimezoneProp,
  /** Query string for PATCH when objective is convert (default: accepted-quotes `to_convert`). */
  convertQueryFilter = "status=to_convert",
}) {
  const accountTimezone = useAccountTimezone(accountTimezoneProp);
  const { formatMoney, currencySymbol } = useMoneyFormatter();
  const [updateJob, { isLoading, error }] = useUpdateJobMutation();
  const [convertJobToSeries, { isLoading: isConvertingToSeries, error: convertToSeriesError }] = useConvertJobToSeriesMutation();
  const [customServices, setCustomServices] = useState([]);
  const [showCustomServiceForm, setShowCustomServiceForm] = useState(false);
  const [customServiceData, setCustomServiceData] = useState({
    name: "",
    duration: "",
    price: ""
  });
  const [jobServices, setJobServices] = useState([]);
  const customServiceSectionRef = useRef(null);

  const { data: employeesData, isLoading: employeesLoading } = useGetEmployeesQuery({ pay_scale_type: 'project' });
  const { data: servicesData, isLoading: servicesLoading } = useGetServicesQuery(1);

  const employees = employeesData?.results || [];
  
  // Get services from API
  const apiServices = servicesData?.results || [];

  const dispatch = useDispatch();
  const { toast } = useToast();
  const isSubmitting = isLoading || isConvertingToSeries;
  const submitError = error || convertToSeriesError;

  // Store form data in the same structure as the job object
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    job_type: "one_time",
    priority: "medium",
    duration_hours: 2,
    scheduled_at: "",
    customer_name: "",
    customer_address: "",
    customer_phone: "",
    customer_email: "",
    notes: "",
    status: "pending",
    total_price: 0,
    quoted_by: null,
    contact_id: null,
    ghl_contact_id: "",
    repeat_every: null,
    repeat_unit: null,
    occurrences: null,
    items: [],
    assignments: [],
  });

  // Contact search and address state
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressEdited, setAddressEdited] = useState(false);
  const [originalAddressString, setOriginalAddressString] = useState("");
  
  // Fetch addresses when contact is selected
  const { data: addressesData, isFetching: isFetchingAddresses } = useGetAddressesByContactQuery(selectedContactId, {
    skip: !selectedContactId,
  });

  // Handle different possible response structures
  const addresses = Array.isArray(addressesData) 
    ? addressesData 
    : addressesData?.results || addressesData?.data || [];

  const [timeData, setTimeData] = useState({
    date: "",
    hour: "12",
    minute: "00",
    period: "PM"
  });

  // Initialize form data directly from job
  useEffect(() => {
    if (open && job) {
      // Reset all state when modal opens or job changes
      setSelectedContact(null);
      // Parse scheduled date (parse as UTC to show time directly from API)
      let parsedTimeData = { date: "", hour: "12", minute: "00", period: "PM" };
      if (job.scheduled_at) {
        const m = moment.utc(job.scheduled_at);
        const dateStr = m.format("YYYY-MM-DD");

        let hours = m.hour();
        const minutes = m.format("mm");
        const period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        parsedTimeData = {
          date: dateStr,
          hour: String(hours),
          minute: minutes,
          period: period
        };
      }
      setTimeData(parsedTimeData);

      // Extract custom services from items
      const extractedCustomServices = [];
      const servicesFromJob = [];
      if (job.items && job.items.length > 0) {
        job.items.forEach(item => {
          if (item.custom_name) {
            extractedCustomServices.push({
              id: item.id,
              name: item.custom_name,
              duration: parseFloat(item.duration_hours) || 1,
              price: parseFloat(item.price) || 0
            });
          } else {
            servicesFromJob.push(item);
          }
        });
      }
      setCustomServices(extractedCustomServices);
      setJobServices(servicesFromJob);

      // Local Contact pk: the API returns it as `contact` (FK id) or inside
      // contact_details — NOT as `contact_id` (which is write-only on the API).
      const localContactId = job.contact ?? job.contact_details?.id ?? null;
      const localAddressId = job.address ?? job.address_details?.id ?? null;

      // Set form data directly from job structure
      setFormData({
        title: job.title || "",
        description: job.description || "",
        job_type: job.job_type || "one_time",
        priority: job.priority || "medium",
        duration_hours: job.duration_hours || 2,
        scheduled_at: job.scheduled_at || "",
        customer_name: job.customer_name || "",
        customer_address: job.customer_address || "",
        customer_phone: job.customer_phone || "",
        customer_email: job.customer_email || "",
        notes: job.notes || "",
        status: objective === 'convert'? "pending": job.status || "pending",
        total_price: job.total_price || 0,
        quoted_by: job.quoted_by || null,
        contact_id: localContactId,
        ghl_contact_id: job.ghl_contact_id || "",
        repeat_every: job.repeat_every || null,
        repeat_unit: job.repeat_unit || null,
        occurrences: job.occurrences || null,
        items: job.items || [],
        assignments: job.assignments || [],
        day_of_week: job.day_of_week
      });

      // Set contact state if the job is linked to a local Contact
      if (localContactId) {
        setSelectedContactId(localContactId);
        if (localAddressId) {
          setSelectedAddressId(localAddressId);
          setAddressEdited(false);
          // Set original address string from job data
          setOriginalAddressString(job.customer_address || "");
        } else {
          setSelectedAddressId(null);
          setAddressEdited(true); // If no address_id, address was likely manually entered
          setOriginalAddressString(job.customer_address || "");
        }
      } else {
        // If no contact_id but we have customer data, allow editing
        // User can search and select a contact to update
        setSelectedContactId(null);
        setSelectedAddressId(null);
        setAddressEdited(false);
        setOriginalAddressString("");
      }
    }
  }, [open, job?.id, job?.customer_address, job?.contact, job?.contact_details?.id, job?.address, job?.scheduled_at, job?.status]);

  // Helper to get selected service IDs
  const getSelectedServiceIds = () => {
    return formData.items.map(item => item.service || item.id);
  };

  // Helper to check if a service is selected
  const isServiceSelected = (serviceId) => {
    return getSelectedServiceIds().includes(serviceId);
  };

  // Helper to get service price from items
  const getServicePrice = (serviceId) => {
    const item = formData.items.find(i => i.service === serviceId || i.id === serviceId);
    return item ? parseFloat(item.price) || 0 : 0;
  };

  // Update scheduled_at when time data changes
  const updateScheduledAt = (updated) => {
    if (updated.date && updated.hour && updated.minute && updated.period) {
      let hour24 = parseInt(updated.hour);
      if (updated.period === "PM" && hour24 !== 12) hour24 += 12;
      if (updated.period === "AM" && hour24 === 12) hour24 = 0;

      // Create moment in UTC directly (user input is already in UTC format, matching calendar display)
      const timeStr = `${String(hour24).padStart(2, '0')}:${updated.minute}:00`;
      const utcMoment = moment.utc(`${updated.date} ${timeStr}`, "YYYY-MM-DD HH:mm:ss");
      const utcIsoString = utcMoment.toISOString();
      
      setFormData(prev => ({ ...prev, scheduled_at: utcIsoString }));
    }
  };

  // Recalculate total price whenever items change
  useEffect(() => {
    const total = formData.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    setFormData(prev => ({
      ...prev,
      total_price: total
    }));
  }, [formData.items]);

  const handleServiceChange = (service, checked) => {
    const serviceId = service.service || service.id;
    if (checked) {
      // Add service to items
      const apiService = apiServices.find(s => s.id === serviceId);
      const jobService = jobServices.find(s => s.service === serviceId);
      const customService = customServices.find(s => s.id === serviceId);

      if (apiService) {
        setFormData(prev => ({
          ...prev,
          items: [...prev.items, {
            service: apiService.id,
            price: parseFloat(apiService.price) || 0,
            duration_hours: parseFloat(apiService.hours) || 1
          }]
        }));
      } else if (jobService) {
        setFormData(prev => ({
          ...prev,
          items: [...prev.items, jobService]
        }));
      } else if (customService) {
        setFormData(prev => ({
          ...prev,
          items: [...prev.items, {
            id: customService.id,
            custom_name: customService.name,
            price: customService.price,
            duration_hours: customService.duration
          }]
        }));
      }
    } else {
      // Remove service from items
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item =>
          (item.service !== serviceId) && (item.id !== serviceId)
        )
      }));
    }
  };

  const handleServicePriceChange = (serviceId, price) => {
    const numPrice = parseFloat(price) || 0;
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.service === serviceId || item.id === serviceId) {
          return { ...item, price: numPrice };
        }
        return item;
      })
    }));
  };

  const addCustomService = () => {
    if (!customServiceData.name.trim()) {
      return;
    }

    const customService = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customServiceData.name.trim(),
      duration: parseInt(customServiceData.duration) || 1,
      price: parseFloat(customServiceData.price) || 0
    };

    setCustomServices(prev => [...prev, customService]);

    // Add to items
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        id: customService.id,
        custom_name: customService.name,
        price: customService.price,
        duration_hours: customService.duration
      }]
    }));

    setCustomServiceData({ name: "", duration: "", price: "" });
    setShowCustomServiceForm(false);
  };

  const removeCustomService = (serviceId) => {
    setCustomServices(prev => prev.filter(s => s.id !== serviceId));
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== serviceId)
    }));
  };

  const sameAssignmentUser = (a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
    return a === b;
  };

  const handleUserAssignment = (userId, checked) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        assignments: [...prev.assignments, { user: userId }],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => !sameAssignmentUser(a.user, userId)),
      }));
    }
  };

  const isUserAssigned = (userId) => {
    return formData.assignments.some((a) => sameAssignmentUser(a.user, userId));
  };

  // Handle contact selection
  const handleContactSelect = (contact) => {
    if (!contact) return;

    setSelectedContact(contact);
    setSelectedContactId(contact.id);
    setSelectedAddressId(null);
    setAddressEdited(false);
    setOriginalAddressString("");

    // Auto-fill customer fields
    const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
    setFormData(prev => ({
      ...prev,
      contact_id: contact.id,
      customer_name: fullName,
      customer_phone: contact.phone || "",
      customer_email: contact.email || "",
      ghl_contact_id: contact.contact_id || "",
      customer_address: "",
    }));
  };

  // Handle address selection from dropdown
  const handleAddressSelect = (addressId) => {
    // Convert to number if it's a string
    const addressIdNum = typeof addressId === 'string' ? parseInt(addressId, 10) : addressId;
    setSelectedAddressId(addressIdNum);
    setAddressEdited(false);
    const selectedAddress = addresses.find(addr => addr.id === addressIdNum || addr.id === addressId);
    if (selectedAddress) {
      const addressParts = [
        selectedAddress.street_address,
        selectedAddress.city,
        selectedAddress.state,
        selectedAddress.postal_code
      ].filter(Boolean);
      const addressString = addressParts.join(", ");
      setOriginalAddressString(addressString);
      
      setFormData(prev => ({
        ...prev,
        customer_address: addressString,
      }));
    }
  };

  // Handle manual address editing
  const handleAddressChange = (e) => {
    const newValue = e.target.value;
    setFormData(prev => ({
      ...prev,
      customer_address: newValue,
    }));
    
    if (selectedAddressId && originalAddressString) {
      // Address was selected from dropdown - check if it's been modified
      const isEdited = newValue.trim() !== originalAddressString.trim();
      setAddressEdited(isEdited);
      // If address was manually edited, clear the selected address from dropdown
      if (isEdited) {
        setSelectedAddressId(null);
      }
    } else {
      // If no address was selected from dropdown, consider it manually entered
      setAddressEdited(newValue.trim() !== "");
      // Ensure selectedAddressId is null when manually entering
      if (selectedAddressId) {
        setSelectedAddressId(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Job title is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "At least one service is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.assignments || formData.assignments.length === 0) {
      toast({
        title: "Error",
        description: "At least one team member must be assigned",
        variant: "destructive",
      });
      return;
    }

    try {
      // Clean up items - ensure proper structure
      const cleanedItems = formData.items.map(item => {
        if (item.service) {
          // Database service
          return {
            service: item.service,
            price: parseFloat(item.price) || 0,
            duration_hours: parseFloat(item.duration_hours) || 1
          };
        } else {
          // Custom service
          return {
            custom_name: item.custom_name,
            price: parseFloat(item.price) || 0,
            duration_hours: parseFloat(item.duration_hours) || 1
          };
        }
      });

      // Prepare payload - remove customer_name, customer_phone, customer_email
      // Add address_id if address was selected from dropdown and not edited
      // Add customer_address if address was manually edited or entered manually
      const payload = {
        ...formData,
        items: cleanedItems,
        duration_hours: parseFloat(formData.duration_hours),
        total_price: parseFloat(formData.total_price),
        // Remove customer_name, customer_phone, customer_email from payload
        customer_name: undefined,
        customer_phone: undefined,
        customer_email: undefined,
        // Add address_id if address was selected from dropdown and not manually edited
        // Add customer_address if address was manually edited or entered manually
        ...(selectedAddressId && !addressEdited && formData.customer_address.trim() 
          ? { address_id: selectedAddressId }
          : formData.customer_address.trim() 
            ? { customer_address: formData.customer_address.trim() }
            : {}
        ),
        contact_id: formData.contact_id,
        // Remove ghl_contact_id if we have contact_id
        ...(formData.contact_id ? { ghl_contact_id: undefined } : {}),
      };

      // Clean up undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const shouldConvertToSeries = objective === "convert" && formData.job_type === "recurring";
      const result = shouldConvertToSeries
        ? await convertJobToSeries({
            id: job.id,
            payload,
          }).unwrap()
        : await updateJob({
            id: job.id,
            ...(objective === "convert" ? { filter: convertQueryFilter } : {}),
            ...payload,
          }).unwrap();

      // Show success message
      if (objective === 'convert') {
        toast({
          title: "Success",
          description: "Quote converted to job successfully!",
        });
      } else {
        toast({
          title: "Success",
          description: "Job updated successfully!",
        });
      }

      if (handleJobUpdate) {
        handleJobUpdate(result);
      }

      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err?.data?.message || (objective === 'convert' ? "Failed to convert quote to job. Please try again." : "Failed to update job. Please try again."),
        variant: "destructive",
      });
    }
  };

  const isRecurring = formData.job_type === "recurring";

  // Helper to convert priority string to number for select
  const priorityToNumber = (priority) => {
    switch (priority) {
      case "low": return 1;
      case "medium": return 2;
      case "high": return 3;
      default: return 2;
    }
  };

  // Helper to convert number to priority string
  const numberToPriority = (num) => {
    switch (parseInt(num)) {
      case 1: return "low";
      case 2: return "medium";
      case 3: return "high";
      default: return "medium";
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: {
          zIndex: 1201, // Modal content layer
          maxWidth: { xs: '100%', sm: '600px', md: '900px' },
          maxHeight: { xs: '100vh', sm: '90vh' },
          margin: { xs: 0, sm: 'auto' },
          borderRadius: { xs: 0, sm: 1 },
        }
      }}
      BackdropProps={{
        sx: {
          zIndex: 1199, // Modal backdrop layer
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }
      }}
      fullScreen={false}
      sx={{
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-end', sm: 'center' },
        }
      }}
      disableEnforceFocus={true}
      disableAutoFocus={false}
      disableRestoreFocus={false}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 2, // space for button
        }}
      >
        { objective === 'convert' ? "Convert to job": "Edit Job"}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <XSquare color="#8FABD4" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-3">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Job Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Window cleaning for office building"
                required
              />
            </div>

            {/* Services */}
            <div className="space-y-2">
              <Label htmlFor="services">Services *</Label>
              <Card className="border">
                <CardContent className="pt-4 px-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4">
                      {/* Loading Skeleton */}
                      {servicesLoading && (
                        <>
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="border rounded-lg p-3">
                              <div className="flex items-start space-x-3">
                                <Skeleton className="h-4 w-4 rounded mt-1" />
                                <div className="flex-1 min-w-0 space-y-2">
                                  <Skeleton className="h-4 w-3/4" />
                                  <Skeleton className="h-3 w-1/2" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      
                      {/* Database Services from API */}
                      {!servicesLoading && apiServices.map(service => (
                        <div key={service.id} className="border rounded-lg p-3">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`service-${service.id}`}
                              checked={isServiceSelected(service.id)}
                              onCheckedChange={(checked) => handleServiceChange(service, checked)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <Label
                                htmlFor={`service-${service.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {service.name}
                              </Label>
                              <div className="text-xs text-muted-foreground mt-1">
                                {service.hours && `${service.hours}h`}
                                {service.hours && service.price && " • "}
                                {service.price != null && service.price !== '' && formatMoney(service.price)}
                              </div>
                              {isServiceSelected(service.id) && (
                                <div className="mt-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getServicePrice(service.id) || ''}
                                    onChange={(e) => handleServicePriceChange(service.id, e.target.value)}
                                    placeholder="Price"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Custom Services */}
                    {!servicesLoading && customServices.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <h4 className="text-sm font-medium mb-3">Custom Services</h4>
                        {customServices.map(service => (
                          <div key={service.id} className="border rounded-lg p-3 mb-3">
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                id={`custom-service-${service.id}`}
                                checked={isServiceSelected(service.id)}
                                onCheckedChange={(checked) => handleServiceChange(service.id, checked)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <Label
                                    htmlFor={`custom-service-${service.id}`}
                                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                                  >
                                    {service.name}
                                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                                  </Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeCustomService(service.id)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive/90"
                                  >
                                    ×
                                  </Button>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {service.duration}h • {formatMoney(service.price)}
                                </div>
                                {isServiceSelected(service.id) && (
                                  <div className="mt-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={getServicePrice(service.id) || ''}
                                      onChange={(e) => handleServicePriceChange(service.id, e.target.value)}
                                      placeholder="Price"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                  {/* Add Custom Service Section */}
                  <div ref={customServiceSectionRef} className="mt-4 pt-4 border-t">
                    {!showCustomServiceForm ? (
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={() => setShowCustomServiceForm(true)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Service
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">New Custom Service</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowCustomServiceForm(false);
                              setCustomServiceData({ name: "", duration: "", price: "" });
                            }}
                            className="h-8 w-8 p-0"
                          >
                            ×
                          </Button>
                        </div>
                        <Input
                          placeholder="Service name"
                          value={customServiceData.name}
                          onChange={(e) => setCustomServiceData(prev => ({ ...prev, name: e.target.value }))}
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            placeholder="Hours"
                            value={customServiceData.duration}
                            onChange={(e) => setCustomServiceData(prev => ({ ...prev, duration: e.target.value }))}
                            step="0.5"
                            min="0"
                          />
                          <Input
                            type="number"
                            placeholder="Price"
                            value={customServiceData.price}
                            onChange={(e) => setCustomServiceData(prev => ({ ...prev, price: e.target.value }))}
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={addCustomService}
                          size="sm"
                          className="w-full"
                        >
                          Add Service
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the job..."
              rows={3}
            />
          </div>

          {/* Job Details Row */}
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Priority and Status */}
            <div className="flex gap-1">
              <FormControl fullWidth size="small">
                <InputLabel id="priority-label">Priority</InputLabel>
                <Select
                  labelId="priority-label"
                  id="priority"
                  value={priorityToNumber(formData.priority).toString()}
                  label="Priority"
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: numberToPriority(e.target.value) }))}
                >
                  <MenuItem value="1">Low</MenuItem>
                  <MenuItem value="2">Medium</MenuItem>
                  <MenuItem value="3">High</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" disabled={objective === 'convert'}>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  id="status"
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="service_due">Service Due</MenuItem>
                  <MenuItem value="on_the_way">On The Way</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="onhold">On Hold</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </div>

            {/* Duration and Price */}
            <div className="space-y-1">
              <div className="flex gap-1">
                <TextField
                  id="estimated_duration"
                  label="Duration (hours)"
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0.5, step: 0.5 }}
                  value={formData.duration_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: parseFloat(e.target.value) || 0 }))}
                  placeholder="2"
                />

                <TextField
                  id="price"
                  label={`Price (${currencySymbol})`}
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                  value={formData.total_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="100.00"
                />
              </div>
              {jobSurchargeAmount(job) > 0 && (
                <p className="text-xs text-muted-foreground px-0.5">
                  Surcharge:{" "}
                  {formatMoney(jobSurchargeAmount(job))}{" "}
                  · Total with surcharge:{" "}
                  {formatMoney(jobGrandTotalAmount({ ...job, total_price: formData.total_price }))}
                </p>
              )}
            </div>

            {/* Date and Time */}
            <div className="flex justify-between gap-2">
              <TextField
                fullWidth
                id="scheduled_date"
                label="Date"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={timeData.date || ""}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setTimeData(prevTime => {
                    const updated = { ...prevTime, date: newDate };
                    updateScheduledAt(updated);
                    return updated;
                  });
                }}
              />
              <FormControl fullWidth size="small">
                <InputLabel id="hour-label">Hour</InputLabel>
                <Select
                  labelId="hour-label"
                  value={timeData.hour || ""}
                  label="Hour"
                  onChange={(e) => {
                    const value = e.target.value;
                    setTimeData(prevTime => {
                      const updated = { ...prevTime, hour: value };
                      updateScheduledAt(updated);
                      return updated;
                    });
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <MenuItem key={h} value={String(h)}>
                      {h}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            <div className="flex justify-between gap-2">
              <FormControl fullWidth size="small">
                <InputLabel id="minute-label">Minute</InputLabel>
                <Select
                  labelId="minute-label"
                  value={timeData.minute || ""}
                  label="Minute"
                  onChange={(e) => {
                    const value = e.target.value;
                    setTimeData(prevTime => {
                      const updated = { ...prevTime, minute: value };
                      updateScheduledAt(updated);
                      return updated;
                    });
                  }}
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="period-label">Period</InputLabel>
                <Select
                  labelId="period-label"
                  value={timeData.period || ""}
                  label="Period"
                  onChange={(e) => {
                    const value = e.target.value;
                    setTimeData(prevTime => {
                      const updated = { ...prevTime, period: value };
                      updateScheduledAt(updated);
                      return updated;
                    });
                  }}
                >
                  <MenuItem value="AM">AM</MenuItem>
                  <MenuItem value="PM">PM</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>

          {/* Customer Information */}
          <Card>
            <CardHeader
              avatar={<Users className="h-5 w-5" />}
              title="Customer Information"
            />
            <CardContent className="space-y-4">
              {/* Contact Search */}
              <div className="space-y-2">
                <ContactSearchableSelect
                  label="Search Contact"
                  useSearchHook={useSearchContactsQuery}
                  onSelect={handleContactSelect}
                  value={selectedContact ? `${selectedContact.first_name || ""} ${selectedContact.last_name || ""}`.trim() : formData.customer_name}
                />
                {!selectedContactId && (
                  <p className="text-sm text-amber-600 mt-1">
                    Please search and select a contact to update customer information. Fields will be auto-filled once a contact is selected.
                  </p>
                )}
              </div>

              {/* Customer Fields - Read-only when contact is selected */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    placeholder="John Doe"
                    disabled={true}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ghl_contact_id">GHL Contact ID</Label>
                  <Input
                    id="ghl_contact_id"
                    value={formData.ghl_contact_id}
                    placeholder="GoHighLevel contact ID"
                    disabled={true}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    placeholder="(555) 123-4567"
                    disabled={true}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    placeholder="john@example.com"
                    disabled={true}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Address Selection */}
              {(selectedContactId || formData.contact_id) && (
                <div className="space-y-2">
                  <Label htmlFor="address_select">Select Address</Label>
                  {isFetchingAddresses ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading addresses...
                    </div>
                  ) : addresses.length > 0 ? (
                    <ShadcnSelect
                      value={selectedAddressId ? String(selectedAddressId) : ""}
                      onValueChange={(value) => handleAddressSelect(value)}
                    >
                      <SelectTrigger id="address_select">
                        <SelectValue placeholder="Select an address" />
                      </SelectTrigger>
                      <SelectContent className="z-[1500]" position="popper">
                        {addresses.map((address) => {
                          const addressLabel = address.name 
                            ? `${address.name} — ${address.street_address}, ${address.city}, ${address.state}, ${address.postal_code}`
                            : `${address.street_address}, ${address.city}, ${address.state}, ${address.postal_code}`;
                          return (
                            <SelectItem key={address.id} value={String(address.id)}>
                              {addressLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </ShadcnSelect>
                  ) : (
                    <p className="text-sm text-gray-500">No addresses found for this contact.</p>
                  )}
                </div>
              )}

              {/* Address Field - Always Editable in Edit Mode */}
              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Textarea
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={handleAddressChange}
                  placeholder="123 Main St, City, State 12345"
                  rows={2}
                />
                {(selectedContactId || formData.contact_id) && (
                  <p className="text-xs text-gray-500">
                    You can edit the address above after selecting one from the dropdown, or enter it manually.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Assignment */}
          <Card>
            <CardHeader
              avatar={<Users className="h-5 w-5" />}
              title="Team Assignment"
            />
            <CardContent className="space-y-4">
              <FormControl fullWidth>
                <InputLabel id="quoted-by-label">Quoted By</InputLabel>
                <Select
                  labelId="quoted-by-label"
                  id="quoted_by"
                  value={formData.quoted_by || ""}
                  label="Quoted By"
                  displayEmpty
                  onChange={(e) => setFormData(prev => ({ ...prev, quoted_by: e.target.value || null }))}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.user_id || employee.id}>
                      {employee.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <div className="space-y-2">
                <Label>Assign Team Members *</Label>
                <JobTeamAssignmentField
                  employees={employees}
                  employeesLoading={employeesLoading}
                  jobDateYmd={timeData.date?.trim() || null}
                  jobScheduleTime={{
                    hour: timeData.hour,
                    minute: timeData.minute,
                    period: timeData.period,
                  }}
                  jobDurationHours={formData.duration_hours}
                  isUserAssigned={isUserAssigned}
                  onToggleUser={handleUserAssignment}
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Settings */}
        { objective === 'convert' && 
          <Card>
            <CardHeader
              avatar={<RotateCcw className="h-5 w-5" />}
              title="Job Settings"
            />
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="one_time"
                  checked={formData.job_type==='one_time'}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, job_type: checked ? "one_time" : "recurring" }))}
                />
                <Label htmlFor="one_time" className="cursor-pointer">This is a first time job</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_recurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    job_type: checked ? "recurring" : "one_time",
                    repeat_every: checked ? (prev.repeat_every || 1) : null,
                    repeat_unit: checked ? (prev.repeat_unit || "day") : null,
                    occurrences: checked ? (prev.occurrences || 1) : null,
                    day_of_week: checked ? (prev.day_of_week) : null
                  }))}
                />
                <Label htmlFor="is_recurring" className="cursor-pointer">This is a recurring job</Label>
              </div>

              {isRecurring && (
                <div className="space-y-4 pl-4 sm:pl-6 border-l-2 border-muted">
                  <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="interval">Repeat Every</Label>
                      <Input
                        id="interval"
                        type="number"
                        min="1"
                        max="52"
                        value={formData.repeat_every || 1}
                        onChange={(e) => setFormData(prev => ({ ...prev, repeat_every: parseInt(e.target.value) || 1 }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label id="frequency-label">Unit</Label>
                      <FormControl fullWidth size="small" variant="">
                        {/* <InputLabel id="frequency-label">Unit</InputLabel> */}
                        <Select
                          labelId="frequency-label"
                          id="frequency"
                          value={formData.repeat_unit || "day"}
                          label="Unit"
                          onChange={(e) => setFormData(prev => ({ ...prev, repeat_unit: e.target.value }))}
                          inputProps={{ 'aria-label': 'Without label' }}
                          input={<OutlinedInput notched={false} />}
                        >
                          <MenuItem value="day">Day(s)</MenuItem>
                          <MenuItem value="week">Week(s)</MenuItem>
                          <MenuItem value="month">Month(s)</MenuItem>
                          <MenuItem value="quarter">Quarter(s)</MenuItem>
                          <MenuItem value="semi_annual">Semi Annual(s)</MenuItem>
                          <MenuItem value="year">Year(s)</MenuItem>
                        </Select>
                      </FormControl>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="recurrence_count">Occurrences</Label>
                      <Input
                        id="recurrence_count"
                        type="number"
                        min="1"
                        max="365"
                        value={formData.occurrences || 1}
                        onChange={(e) => setFormData(prev => ({ ...prev, occurrences: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  {formData.repeat_unit === 'week' && (
                    <div className="space-y-1">
                      <FormControl fullWidth>
                        <InputLabel id="day-of-week-label">Day of Week</InputLabel>
                        <Select
                          labelId="day-of-week-label"
                          id="day_of_week"
                          value={formData.day_of_week || ""}
                          label="Day of Week"
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              day_of_week: e.target.value,
                            }))
                          }
                        >
                          <MenuItem value="0">Sunday</MenuItem>
                          <MenuItem value="1">Monday</MenuItem>
                          <MenuItem value="2">Tuesday</MenuItem>
                          <MenuItem value="3">Wednesday</MenuItem>
                          <MenuItem value="4">Thursday</MenuItem>
                          <MenuItem value="5">Friday</MenuItem>
                          <MenuItem value="6">Saturday</MenuItem>
                        </Select>
                      </FormControl>
                    </div>
                  )}

                  {formData.scheduled_at && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                      {formData.repeat_every > 1 && formData.repeat_unit === 'week' && (
                        <p>Bi-weekly: Every {formData.repeat_every} weeks</p>
                      )}
                      {formData.repeat_every === 1 && formData.repeat_unit === 'week' && (
                        <p>Weekly</p>
                      )}
                      {formData.repeat_unit === 'day' && (
                        <p>Daily: Every {formData.repeat_every} day{formData.repeat_every > 1 ? 's' : ''}</p>
                      )}
                      {formData.repeat_unit === 'month' && (
                        <p>Monthly: Every {formData.repeat_every} month{formData.repeat_every > 1 ? 's' : ''}</p>
                      )}
                      {formData.repeat_unit === 'quarter' && (
                        <p>Quarterly: Every {formData.repeat_every} quarter{formData.repeat_every > 1 ? 's' : ''}</p>
                      )}
                      {formData.repeat_unit === 'semi_annual' && (
                        <p>Semi-annually: Every {formData.repeat_every * 6} months</p>
                      )}
                      {formData.repeat_unit === 'year' && (
                        <p>Yearly: Every {formData.repeat_every} year{formData.repeat_every > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        }

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or special instructions..."
              rows={3}
            />
          </div>

          {/* Error Display */}
          {submitError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {submitError.data?.message || "Failed to update job. Please try again."}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0">
            <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting || !formData.assignments?.length} className="sm:flex-1 w-full">
              {isSubmitting ? "Updating..." : objective === "convert"? "Convert to Job" : "Update Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}