import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateCustomProductMutation, useGetServicesQuery, useUpdateCustomProductMutation } from "../../../store/api/user/quoteApi";
import { getServiceIcon } from "../../../utils/serviceIcons";
import { useSearchParams } from 'react-router-dom';


const MultiServiceSelectionForm = ({ data, onUpdate, isPublicMode = false }) => {

  const [searchParams] = useSearchParams();

  const location_id = searchParams.get('location_id');

  const { data: servicesData, error, isLoading } = useGetServicesQuery(
    {id:data?.submission_id, location_id},
    {
      refetchOnMountOrArgChange: true,
    }
  );

  const [updateCustomProduct, { isLoading: isUpdating }] = useUpdateCustomProductMutation();
  const [createCustomProduct, { isLoading: isCreating }] = useCreateCustomProductMutation();

  const services = servicesData?.services || [];
  // const customProducts = servicesData?.custom_services || [];

  const [customProducts, setCustomProducts] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    description: "",
    price: "",
  });

  useEffect(()=>{
    if (isPublicMode) {
      onUpdate({ selectedCustomProducts: [] });
      return;
    }
    if (servicesData?.custom_services){
      setCustomProducts(servicesData?.custom_services)
    }
    onUpdate({
      selectedCustomProducts: servicesData?.custom_services?.filter((p) => p.is_active) || [],
    });
  },[servicesData, isPublicMode])

  useEffect(() => {
    if (services) {
      onUpdate?.({
        availableLocations: services.locations,
        availableSizes: services.size_ranges,
      });
    }
  }, [services, onUpdate]);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error fetching services</p>;

  // Toggle service selection
  const toggleService = (service) => {
    const existing = data.selectedServices || [];
    const isSelected = existing.find((s) => s.id === service.id);
    const updatedServices = isSelected
      ? existing.filter((s) => s.id !== service.id)
      : [...existing, service];

    onUpdate({ selectedServices: updatedServices });
  };

  // Toggle custom product selection
  const toggleCustomProduct = async (product) => {
    const updatedStatus = !product.is_active;

    await updateCustomProduct({
      id: product.id,
      is_active: updatedStatus,
    }).unwrap();

    const updatedProducts = customProducts.map((p) =>
      p.id === product.id ? { ...p, is_active: updatedStatus } : p
    );

    setCustomProducts(updatedProducts);

    // Pass updated list to parent
    onUpdate({
      selectedCustomProducts: updatedProducts.filter((p) => p.is_active),
    });
  };

  // Add custom product → ideally call API instead of local update
  const handleAddCustomProduct = async() => {
    // Here you should call your backend mutation instead of local update
    // Example: addCustomProductMutation(newProduct).then(refetch)
    try {
      const response = await createCustomProduct({...newProduct, purchase:data?.submission_id}).unwrap();

      setDialogOpen(false);
      setNewProduct({ product_name: '', description: '', price: '' });
    } catch (err) {
      // Error handled by toast notification
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Select Services</h2>

      {/* Services list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {services.map((service) => {
          const checked = data.selectedServices?.some(
            (s) => s.id === service.id
          );
          return (
            <Card
              key={service.id}
              className={`cursor-pointer ${
                checked ? "border-blue-500 bg-blue-50" : ""
              }`}
              onClick={() => toggleService(service)}
            >
              <CardContent className="flex items-center space-x-3 p-4">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleService(service)}
                />
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 flex items-center justify-center">
                    <img 
                      src={getServiceIcon(service.name)} 
                      alt={service.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <p className="font-semibold">{service.name}</p>
                  {/* <p className="text-sm text-gray-600">
                    {service.description}
                  </p> */}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom Products list (from API) — technician only */}
      {!isPublicMode && customProducts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4">Custom Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customProducts.map((prod) => {
              
              return (
                <Card key={prod.id} className={`cursor-pointer ${
                prod.is_active ? "border-blue-500 bg-blue-50" : ""
              }`}
              onClick={() => toggleCustomProduct(prod)}>
                  <CardContent className="flex items-center space-x-3 p-4">
                    <Checkbox
                      checked={prod.is_active}
                      onCheckedChange={() => toggleCustomProduct(prod)}
                    />
                    <div className="w-10 h-10 flex items-center justify-center">
                    <img 
                      src={getServiceIcon(prod.product_name)} 
                      alt={prod.product_name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                    <div>
                      <p className="font-medium">{prod.product_name}</p>
                      <p className="text-sm text-gray-600">{prod.description}</p>
                      <p className="text-sm text-gray-800">$ {prod.price}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Add custom product button — technician only */}
      {!isPublicMode && (
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
      >
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 flex items-center justify-center">
            <img 
              src="/Icons/Others/Custom item.png" 
              alt="Custom Service"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">Create Custom Service</h4>
            <p className="text-sm text-gray-600 mb-2">
              Add a service that's not in our standard offerings
            </p>
          </div>
        </div>
      </button>
      )}
      {/* <Button onClick={() => setDialogOpen(true)}>Add Custom Product</Button> */}

      {/* Dialog for adding custom product */}
      {!isPublicMode && (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Product Name"
              value={newProduct.product_name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, product_name: e.target.value })
              }
            />
            <Input
              placeholder="Description"
              value={newProduct.description}
              onChange={(e) =>
                setNewProduct({ ...newProduct, description: e.target.value })
              }
            />
            <Input
              type="number"
              placeholder="Price"
              value={newProduct.price}
              onChange={(e) =>
                setNewProduct({ ...newProduct, price: Number(e.target.value) })
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomProduct}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
};

export default MultiServiceSelectionForm;
