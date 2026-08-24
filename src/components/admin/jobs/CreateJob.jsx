import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, Badge, FormControl, Grid, InputLabel, MenuItem, Select as MuiSelect, TextField, Typography, OutlinedInput } from "@mui/material";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@mui/material";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Users, RotateCcw, Plus } from "lucide-react";
import moment from "moment-timezone";
import { useGetEmployeesQuery } from "../../../store/api/payrollApi";
import { JobTeamAssignmentField } from "./JobTeamAssignmentField";
import { useCreateJobMutation, useSearchContactsQuery, useGetAddressesByContactQuery } from "../../../store/api/jobsApi";
import { useGetServicesQuery } from "../../../store/api/servicesApi";
import { useGetContactReferralCreditQuery } from "../../../store/api/referralsApi";
import ContactSearchableSelect from "./ContactSearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAccountTimezone } from "@/hooks/useAccountTimezone";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";

export function CreateJobForm({ onSuccess, onCancel, initialData, onJobCreated, onJobCreatedError }) {
  const accountTimezone = useAccountTimezone();
  const { formatMoney, currencySymbol } = useMoneyFormatter();
  const [loading, setLoading] = useState(false);
  const [customServices, setCustomServices] = useState([]);
  const [showCustomServiceForm, setShowCustomServiceForm] = useState(false);
  const [customServiceData, setCustomServiceData] = useState({
    name: "",
    duration: "",
    price: ""
  });
  const customServiceSectionRef = useRef(null);
  
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
    ghl_contact_id: "",
    quoted_by: null,
    created_by: null,
    repeat_every: null,
    repeat_unit: null,
    day_of_week: null,
    occurrences: null,
    items: [],
    assignments: [],
    total_price: 0,
    discount_type: null,
    discount_value: null,
  });
  
  const [timeData, setTimeData] = useState({
    date: "",
    hour: "12",
    minute: "00",
    period: "PM"
  });
  
  const { toast } = useToast();

  const { data: employeesData, isLoading: employeesLoading } = useGetEmployeesQuery({ pay_scale_type: 'project', is_active: true });
  const { data: servicesData, isLoading: servicesLoading } = useGetServicesQuery(1);
  const [createJob] = useCreateJobMutation();
  
  // Get services from API
  const services = servicesData?.results || [];

  const employees = employeesData?.results || [];

  // Contact search and address state
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressEdited, setAddressEdited] = useState(false); // Track if address was manually edited
  const [originalAddressString, setOriginalAddressString] = useState(""); // Store original address from dropdown

  // Fetch addresses when contact is selected
  const { data: addressesData, isFetching: isFetchingAddresses } = useGetAddressesByContactQuery(selectedContactId, {
    skip: !selectedContactId,
  });

  const { data: referralCredit } = useGetContactReferralCreditQuery(selectedContactId, {
    skip: !selectedContactId,
  });

  const availableReferralDollars = Number(referralCredit?.available_credit_dollars || 0);
  const showReferralCredit =
    Boolean(selectedContactId) &&
    Boolean(referralCredit?.program_enabled) &&
    availableReferralDollars > 0;
  const pendingReferral = referralCredit?.pending_referral || null;
  const pendingReferralDollars = Number(pendingReferral?.friend_discount_dollars || 0);
  const showPendingReferral =
    Boolean(selectedContactId) &&
    Boolean(referralCredit?.program_enabled) &&
    Boolean(pendingReferral) &&
    !pendingReferral?.discount_disabled &&
    pendingReferralDollars > 0;
  // NOTE: wallet credit and the referral (friend) discount are applied
  // automatically by the backend — do NOT prefill the manual discount here,
  // otherwise the reduction would be applied twice.

  // Handle different possible response structures
  const addresses = Array.isArray(addressesData) 
    ? addressesData 
    : addressesData?.results || addressesData?.data || [];

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
      ghl_contact_id: contact.contact_id || "", // Use contact.id for GHL Contact ID
      customer_address: "", // Reset address
      discount_type: null,
      discount_value: null,
    }));
  };

  // Handle address selection from dropdown
  const handleAddressSelect = (addressId) => {
    // Convert to number if it's a string (Select returns strings)
    const addressIdNum = typeof addressId === 'string' ? parseInt(addressId, 10) : addressId;
    setSelectedAddressId(addressIdNum);
    setAddressEdited(false); // Reset edited flag when selecting from dropdown
    const selectedAddress = addresses.find(addr => addr.id === addressIdNum || addr.id === addressId);
    if (selectedAddress) {
      // Format address string
      const addressParts = [
        selectedAddress.street_address,
        selectedAddress.city,
        selectedAddress.state,
        selectedAddress.postal_code
      ].filter(Boolean);
      const addressString = addressParts.join(", ");
      setOriginalAddressString(addressString); // Store original address
      
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
    
    // Check if address was edited (different from original)
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

  // Reset form function
  const resetForm = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setSelectedAddressId(null);
    setFormData({
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
      ghl_contact_id: "",
      quoted_by: null,
      created_by: null,
      repeat_every: null,
      repeat_unit: null,
      day_of_week: null,
      occurrences: null,
      items: [],
      assignments: [],
      total_price: 0,
      discount_type: null,
      discount_value: null,
    });
    setCustomServices([]);
    setShowCustomServiceForm(false);
    setCustomServiceData({ name: "", duration: "", price: "" });
    setTimeData({
      date: "",
      hour: "12",
      minute: "00",
      period: "PM"
    });
  };

  useEffect(() => {
    if (initialData) {
      // Parse scheduled date
      let parsedTimeData = { date: "", hour: "12", minute: "00", period: "PM" };
      if (initialData.scheduled_date) {
        const m = moment.parseZone(initialData.scheduled_date).tz(accountTimezone, true);
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

      // Set form data
      setFormData(prev => ({
        ...prev,
        customer_name: initialData.customer_name || "",
        customer_phone: initialData.customer_phone || "",
        customer_email: initialData.customer_email || "",
        customer_address: initialData.customer_address || "",
        scheduled_at: initialData.scheduled_date || "",
        ghl_contact_id: initialData.ghl_contact_id || "",
        title: initialData.jobs_selected?.map(job => job.title || job.name).join(", ") || prev.title,
      }));
    }
  }, [initialData, accountTimezone]);

  useEffect(() => {
    if (initialData && services.length > 0) {
      const extractedCustomServices = [];
      const items = [];
      
      if (initialData.jobs_selected) {
        initialData.jobs_selected.forEach(job => {
          const matchedService = services.find(service => 
            service.name.toLowerCase() === (job.name || job.title || '').toLowerCase() ||
            service.name.toLowerCase().includes((job.name || job.title || '').toLowerCase()) ||
            (job.name || job.title || '').toLowerCase().includes(service.name.toLowerCase())
          );
          
          if (matchedService) {
            items.push({
              service: matchedService.id,
              price: job.price || parseFloat(matchedService.price) || 0,
              duration_hours: job.duration ? Math.round(job.duration / 60) : parseFloat(matchedService.hours) || 0
            });
          } else {
            const customService = {
              id: `custom-${Date.now()}-${Math.random()}`,
              name: job.title || job.name || 'Custom Service',
              duration: job.duration ? Math.round(job.duration / 60) : 1,
              price: job.price || 0
            };
            extractedCustomServices.push(customService);
            items.push({
              id: customService.id,
              custom_name: customService.name,
              price: customService.price,
              duration_hours: customService.duration
            });
          }
        });
      }

      setCustomServices(extractedCustomServices);
      setFormData(prev => ({
        ...prev,
        items: items,
      }));
    }
  }, [initialData, services]);

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
      
      const isoString = `${updated.date}T${String(hour24).padStart(2, '0')}:${updated.minute}:00`;
      setFormData(prev => ({ ...prev, scheduled_at: isoString }));
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
    const serviceId = service.id;
    if (checked) {
      // Add service to items
      const dbService = services.find(s => s.id === serviceId);
      const customService = customServices.find(s => s.id === serviceId);

      if (dbService) {
        setFormData(prev => ({
          ...prev,
          items: [...prev.items, {
            service: dbService.id,
            price: parseFloat(dbService.price) || 0,
            duration_hours: parseFloat(dbService.hours) || 1
          }]
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
      toast({
        title: "Error",
        description: "Service name is required",
        variant: "destructive",
      });
      return;
    }

    const customService = {
      id: `custom-${Date.now()}-${Math.random()}`,
      name: customServiceData.name.trim(),
      duration: parseFloat(customServiceData.duration) || 1,
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
    
    toast({
      title: "Success",
      description: "Custom service added successfully",
    });
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
        assignments: [...prev.assignments, { user: userId, role: "worker" }],
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: Job Title
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Job title is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Services
    if (formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service",
        variant: "destructive",
      });
      return;
    }

    // Validation: Service prices (each service must have a price > 0)
    const invalidServices = formData.items.filter(item => !item.price || parseFloat(item.price) <= 0);
    if (invalidServices.length > 0) {
      toast({
        title: "Error",
        description: "All services must have a valid price greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validation: Duration
    if (!formData.duration_hours || parseFloat(formData.duration_hours) <= 0) {
      toast({
        title: "Error",
        description: "Duration is required and must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validation: Total Price
    if (!formData.total_price || parseFloat(formData.total_price) <= 0) {
      toast({
        title: "Error",
        description: "Price is required and must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validation: Date
    if (!timeData.date || !timeData.date.trim()) {
      toast({
        title: "Error",
        description: "Date is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Hour
    if (!timeData.hour || !timeData.hour.trim()) {
      toast({
        title: "Error",
        description: "Hour is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Minute
    if (!timeData.minute || !timeData.minute.trim()) {
      toast({
        title: "Error",
        description: "Minute is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Period
    if (!timeData.period || !timeData.period.trim()) {
      toast({
        title: "Error",
        description: "Period (AM/PM) is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Contact must be selected
    if (!selectedContactId) {
      toast({
        title: "Error",
        description: "Please search and select a contact to continue",
        variant: "destructive",
      });
      return;
    }

    // Validation: Customer Name
    if (!formData.customer_name || !formData.customer_name.trim()) {
      toast({
        title: "Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Customer Phone
    // if (!formData.customer_phone || !formData.customer_phone.trim()) {
    //   toast({
    //     title: "Error",
    //     description: "Customer phone is required",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    // Validation: Customer Email
    if (!formData.customer_email || !formData.customer_email.trim()) {
      toast({
        title: "Error",
        description: "Customer email is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.customer_email.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validation: GHL Contact ID
    if (!formData.ghl_contact_id || !formData.ghl_contact_id.trim()) {
      toast({
        title: "Error",
        description: "GHL Contact ID is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Customer Address
    if (!formData.customer_address || !formData.customer_address.trim()) {
      toast({
        title: "Error",
        description: "Customer address is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Quoted By
    if (!formData.quoted_by) {
      toast({
        title: "Error",
        description: "Quoted By is required",
        variant: "destructive",
      });
      return;
    }

    // Validation: Team Members Assignment
    if (!formData.assignments || formData.assignments.length === 0) {
      toast({
        title: "Error",
        description: "At least one team member must be assigned",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
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

      // Prepare payload
      const payload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        duration_hours: parseFloat(formData.duration_hours),
        scheduled_at: formData.scheduled_at,
        job_type: formData.job_type,
        // Remove customer_name, customer_phone, customer_email from payload
        // Add address_id if address was selected from dropdown and not manually edited
        // Add customer_address if address was manually edited or entered manually
        ...(selectedAddressId && !addressEdited && formData.customer_address.trim() 
          ? { address_id: selectedAddressId }
          : formData.customer_address.trim() 
            ? { customer_address: formData.customer_address.trim() }
            : {}
        ),
        contact_id: formData.contact_id,
        quoted_by: formData.quoted_by,
        created_by: formData.created_by,
        notes: formData.notes,
        items: cleanedItems,
        assignments: formData.assignments,
        total_price: parseFloat(formData.total_price),
        ...(formData.discount_type && Number(formData.discount_value) > 0
          ? {
              discount_type: formData.discount_type,
              discount_value: String(Number(formData.discount_value).toFixed(2)),
            }
          : {
              discount_type: null,
              discount_value: "0.00",
            }),
      };

      // Add recurring fields if job is recurring
      if (formData.job_type === "recurring") {
        payload.repeat_every = formData.repeat_every;
        payload.repeat_unit = formData.repeat_unit;
        payload.occurrences = formData.occurrences;
        if (formData.repeat_unit === "week" && formData.day_of_week !== null) {
          payload.day_of_week = formData.day_of_week;
        }
      }

      // Call appropriate API based on job type
      const apiEndpoint = formData.job_type === "recurring" ? "jobs-series" : "jobs";

      // Use unwrap() to properly handle errors - this will throw on 400/500 status codes
      const result = await createJob({
        apiEndpoint: apiEndpoint,
        payload: payload,
      }).unwrap();

      // Only show success if we get here (no error thrown, status 200/201)
      toast({
        title: "Success",
        description: `Job ${formData.job_type === "recurring" ? "series" : ""} created successfully`,
      });

      // Reset form state after successful creation
      resetForm();

      if (onSuccess) {
        onSuccess();
      }
      
      if (onJobCreated) {
        onJobCreated(result || payload);
      }
    } catch (err) {
      // Extract error message from RTK Query unwrap error
      // Error structure: { status, data } when using unwrap()
      const errorMessage = err?.data?.message || err?.data?.error || err?.message || "Failed to create job. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      if (onJobCreatedError) {
        onJobCreatedError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const isRecurring = formData.job_type === "recurring";
  const isFirstTime = formData.job_type === "one_time";


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
    <form onSubmit={handleSubmit} className="space-y-6 mx-auto">
      {/* Title and Services Row */}
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
                  
                  {/* Database Services */}
                  {!servicesLoading && services.map(service => (
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
                              onCheckedChange={(checked) => handleServiceChange(service, checked)}
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
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomServiceForm(true);
                      setTimeout(() => {
                        customServiceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }, 100);
                    }}
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
        {/* Priority */}
        <div className="flex gap-1">
          <FormControl fullWidth size="small">
            <InputLabel id="priority-label">Priority</InputLabel>
            <MuiSelect
              labelId="priority-label"
              id="priority"
              value={priorityToNumber(formData.priority).toString()}
              label="Priority"
              onChange={(e) => setFormData(prev => ({ ...prev, priority: numberToPriority(e.target.value) }))}
            >
              <MenuItem value="1">Low</MenuItem>
              <MenuItem value="2">Medium</MenuItem>
              <MenuItem value="3">High</MenuItem>
            </MuiSelect>
          </FormControl>

          {/* Duration */}
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
        </div>

        {/* Price */}
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

        {showPendingReferral && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Referral discount {formatMoney(pendingReferralDollars)} (referred by {pendingReferral.referrer_name})
            will be applied to this job automatically. You can disable it from the job details after creation.
          </Alert>
        )}
        {showReferralCredit && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Referral wallet credit available: {formatMoney(availableReferralDollars)}. It is applied
            automatically when the invoice is created — no need to add it as a discount here.
          </Alert>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <FormControl size="small" fullWidth>
            <InputLabel id="discount-type-label">Discount type</InputLabel>
            <MuiSelect
              labelId="discount-type-label"
              label="Discount type"
              value={formData.discount_type || "none"}
              onChange={(e) => {
                const value = e.target.value === "none" ? null : e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  discount_type: value,
                  discount_value: value ? prev.discount_value || "" : null,
                }));
              }}
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="amount">Amount ({currencySymbol})</MenuItem>
              <MenuItem value="percentage">Percentage (%)</MenuItem>
            </MuiSelect>
          </FormControl>
          <TextField
            id="discount_value"
            label={formData.discount_type === "percentage" ? "Discount %" : `Discount (${currencySymbol})`}
            type="number"
            size="small"
            fullWidth
            disabled={!formData.discount_type}
            inputProps={{ min: 0, step: 0.01 }}
            value={formData.discount_value ?? ""}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                discount_value: e.target.value === "" ? "" : parseFloat(e.target.value),
              }));
            }}
            placeholder="0.00"
          />
        </div>
        
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
              setTimeData((prevTime) => {
                const updated = { ...prevTime, date: newDate };
                updateScheduledAt(updated);
                return updated;
              });
            }}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="hour-label">Hour</InputLabel>
            <MuiSelect
              labelId="hour-label"
              value={timeData.hour || ""}
              label="Hour"
              onChange={(e) => {
                const value = e.target.value;
                setTimeData((prevTime) => {
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
            </MuiSelect>
          </FormControl>
        </div>
        
        <div className="flex justify-between gap-2">
          <FormControl fullWidth size="small">
            <InputLabel id="minute-label">Minute</InputLabel>
            <MuiSelect
              labelId="minute-label"
              value={timeData.minute || ""}
              label="Minute"
              onChange={(e) => {
                const value = e.target.value;
                setTimeData((prevTime) => {
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
            </MuiSelect>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="period-label">Period</InputLabel>
            <MuiSelect
              labelId="period-label"
              value={timeData.period || ""}
              label="Period"
              onChange={(e) => {
                const value = e.target.value;
                setTimeData((prevTime) => {
                  const updated = { ...prevTime, period: value };
                  updateScheduledAt(updated);
                  return updated;
                });
              }}
            >
              <MenuItem value="AM">AM</MenuItem>
              <MenuItem value="PM">PM</MenuItem>
            </MuiSelect>
          </FormControl>
        </div>
      </div>

      {/* Customer Information */}
      <Card>
        <CardHeader
          avatar={<Users className="h-5 w-5"/>}
          title="Customer Information"
        />
        <CardContent className="space-y-4">
          {/* Contact Search */}
          <div className="space-y-2">
            <ContactSearchableSelect
              label="Search Contact"
              useSearchHook={useSearchContactsQuery}
              onSelect={handleContactSelect}
              value={selectedContact ? `${selectedContact.first_name || ""} ${selectedContact.last_name || ""}`.trim() : ""}
            />
            {!selectedContactId && (
              <p className="text-sm text-amber-600 mt-1">
                Please search and select a contact to continue. Fields will be auto-filled once a contact is selected.
              </p>
            )}
            {showPendingReferral && (
              <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
                Referred customer: {formatMoney(pendingReferralDollars)} referral discount
                (referred by {pendingReferral.referrer_name}) applies to their first job automatically.
              </Alert>
            )}
            {showReferralCredit && (
              <Alert severity="success" sx={{ mt: 1, py: 0.5 }}>
                This customer has {formatMoney(availableReferralDollars)} referral credit available.
              </Alert>
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
          {selectedContactId && (
            <div className="space-y-2">
              <Label htmlFor="address_select">Select Address</Label>
              {isFetchingAddresses ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading addresses...
                </div>
              ) : addresses.length > 0 ? (
                <Select
                  value={selectedAddressId ? String(selectedAddressId) : ""}
                  onValueChange={handleAddressSelect}
                >
                  <SelectTrigger id="address_select">
                    <SelectValue placeholder="Select an address" />
                  </SelectTrigger>
                  <SelectContent>
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
                </Select>
              ) : (
                <p className="text-sm text-gray-500">No addresses found for this contact.</p>
              )}
            </div>
          )}

          {/* Address Field - Editable */}
          <div className="space-y-2">
            <Label htmlFor="customer_address">Address</Label>
            <Textarea
              id="customer_address"
              value={formData.customer_address}
              onChange={handleAddressChange}
              placeholder="123 Main St, City, State 12345"
              rows={2}
              disabled={!selectedContactId}
            />
            {selectedContactId && (
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
          avatar={<Users className="h-5 w-5"/>}
          title="Team Assignment"
        />
        <CardContent className="space-y-4">
          <FormControl fullWidth>
            <InputLabel id="quoted-by-label">Quoted By</InputLabel>
            <MuiSelect
              labelId="quoted-by-label"
              id="quoted_by"
              value={formData.quoted_by || ""}
              label="Quoted By"
              onChange={(e) => setFormData(prev => ({ ...prev, quoted_by: e.target.value || null }))}
            >
              {employees?.map((employee) => (
                <MenuItem key={employee.id} value={employee.user_id || employee.id}>
                  {employee.full_name}
                </MenuItem>
              ))}
            </MuiSelect>
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
      <Card>
        <CardHeader
          avatar={<RotateCcw className="h-5 w-5"/>}
          title="Job Settings"
        />
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="first_time"
              checked={isFirstTime}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, job_type: checked ? "one_time": 'recurring',
                repeat_every: null,
                repeat_unit: null,
                occurrences: null,
                day_of_week: null
               }))}
            />
            <Label htmlFor="first_time" className="cursor-pointer">This is a first time job</Label>
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
                day_of_week: checked ? prev.day_of_week : null
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
                  <FormControl fullWidth size="small">
                    <MuiSelect
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
                    </MuiSelect>
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
                    <MuiSelect
                      labelId="day-of-week-label"
                      id="day_of_week"
                      value={formData.day_of_week !== null ? formData.day_of_week : ""}
                      label="Day of Week"
                      onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: e.target.value !== "" ? parseInt(e.target.value) : null }))}
                    >
                      <MenuItem value="0">Sunday</MenuItem>
                      <MenuItem value="1">Monday</MenuItem>
                      <MenuItem value="2">Tuesday</MenuItem>
                      <MenuItem value="3">Wednesday</MenuItem>
                      <MenuItem value="4">Thursday</MenuItem>
                      <MenuItem value="5">Friday</MenuItem>
                      <MenuItem value="6">Saturday</MenuItem>
                    </MuiSelect>
                  </FormControl>
                </div>
              )}

              {formData.scheduled_at && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  {formData.repeat_every > 1 && formData.repeat_unit === 'week' && (
                    <p>Bi-weekly: Every {formData.repeat_every} weeks{formData.day_of_week !== null && ` on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][formData.day_of_week]}`}</p>
                  )}
                  {formData.repeat_every === 1 && formData.repeat_unit === 'week' && formData.day_of_week !== null && (
                    <p>Weekly: Every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][formData.day_of_week]}</p>
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

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sticky bottom-0 bg-background py-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="sm:w-auto w-full">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !formData.assignments?.length} className="sm:flex-1 w-full">
          {loading ? "Creating..." : "Create Job"}
        </Button>
      </div>
    </form>
  );
}