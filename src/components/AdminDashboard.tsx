import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ArrowLeft, TrendingUp, Package, Users, Lock, FolderOpen, CreditCard, Settings } from 'lucide-react';
import { MenuItem, Variation, CustomField } from '../types';
import { useMenu } from '../hooks/useMenu';
import { useCategories } from '../hooks/useCategories';
import ImageUpload from './ImageUpload';
import CategoryManager from './CategoryManager';
import PaymentMethodManager from './PaymentMethodManager';
import SiteSettingsManager from './SiteSettingsManager';
import { supabase } from '../lib/supabase';

const AdminDashboard: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('beracah_admin_auth') === 'true';
  });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [adminPassword, setAdminPassword] = useState<string>('AmberKin@Admin!2025'); // Default fallback
  const { menuItems, loading, addMenuItem, updateMenuItem, deleteMenuItem } = useMenu();
  const { categories } = useCategories();
  const [currentView, setCurrentView] = useState<'dashboard' | 'items' | 'add' | 'edit' | 'categories' | 'payments' | 'settings'>('dashboard');

  // Fetch admin password from database on mount
  useEffect(() => {
    const fetchAdminPassword = async () => {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'admin_password')
          .single();

        if (!error && data?.value) {
          setAdminPassword(data.value);
        }
      } catch (err) {
        console.error('Error fetching admin password:', err);
        // Keep default password on error
      }
    };

    fetchAdminPassword();
  }, []);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    basePrice: 0,
    category: 'hot-coffee',
    popular: false,
    available: true,
    variations: [],
    customFields: []
  });

  const handleAddItem = () => {
    setCurrentView('add');
    const defaultCategory = categories.length > 0 ? categories[0].id : 'dim-sum';
    setFormData({
      name: '',
      basePrice: 0,
      category: defaultCategory,
      popular: false,
      available: true,
      variations: [],
      customFields: []
    });
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setCurrentView('edit');
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        setIsProcessing(true);
        await deleteMenuItem(id);
      } catch (error) {
        alert('Failed to delete item. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSaveItem = async () => {
    if (!formData.name) {
      alert('Please fill in all required fields');
      return;
    }

    // Currency packages are required
    if (!formData.variations || formData.variations.length === 0) {
      alert('Please add at least one currency package');
      return;
    }

    // Validate currency packages
    const invalidPackages = formData.variations.filter(v => !v.name || v.price <= 0);
    if (invalidPackages.length > 0) {
      alert('Please fill in all currency package names and set valid prices (greater than 0)');
      return;
    }

    // Validate discount percentage if enabled
    if (formData.discountActive && formData.discountPercentage !== undefined) {
      if (formData.discountPercentage < 0 || formData.discountPercentage > 100) {
        alert('Discount percentage must be between 0 and 100');
        return;
      }
    }

    try {
      // Set basePrice to 0 since we don't use it anymore
      const itemData = {
        ...formData,
        basePrice: 0
      };

      if (editingItem) {
        await updateMenuItem(editingItem.id, itemData);
      } else {
        await addMenuItem(itemData as Omit<MenuItem, 'id'>);
      }
      setCurrentView('items');
      setEditingItem(null);
    } catch (error) {
      alert('Failed to save item');
    }
  };

  const handleCancel = () => {
    setCurrentView(currentView === 'add' || currentView === 'edit' ? 'items' : 'dashboard');
    setEditingItem(null);
    setSelectedItems([]);
  };

  const handleBulkRemove = async () => {
    if (selectedItems.length === 0) {
      alert('Please select items to delete');
      return;
    }

    const itemNames = selectedItems.map(id => {
      const item = menuItems.find(i => i.id === id);
      return item ? item.name : 'Unknown Item';
    }).slice(0, 5); // Show first 5 items
    
    const displayNames = itemNames.join(', ');
    const moreItems = selectedItems.length > 5 ? ` and ${selectedItems.length - 5} more items` : '';
    
    if (confirm(`Are you sure you want to delete ${selectedItems.length} item(s)?\n\nItems to delete: ${displayNames}${moreItems}\n\nThis action cannot be undone.`)) {
      try {
        setIsProcessing(true);
        // Delete items one by one
        for (const itemId of selectedItems) {
          await deleteMenuItem(itemId);
        }
        setSelectedItems([]);
        setShowBulkActions(false);
        alert(`Successfully deleted ${selectedItems.length} item(s).`);
      } catch (error) {
        alert('Failed to delete some items. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };
  const handleBulkCategoryChange = async (newCategoryId: string) => {
    if (selectedItems.length === 0) {
      alert('Please select items to update');
      return;
    }

    const categoryName = categories.find(cat => cat.id === newCategoryId)?.name;
    if (confirm(`Are you sure you want to change the category of ${selectedItems.length} item(s) to "${categoryName}"?`)) {
      try {
        setIsProcessing(true);
        // Update category for each selected item
        for (const itemId of selectedItems) {
          const item = menuItems.find(i => i.id === itemId);
          if (item) {
            await updateMenuItem(itemId, { ...item, category: newCategoryId });
          }
        }
        setSelectedItems([]);
        setShowBulkActions(false);
        alert(`Successfully updated category for ${selectedItems.length} item(s)`);
      } catch (error) {
        alert('Failed to update some items');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === menuItems.length) {
      setSelectedItems([]);
      setShowBulkActions(false);
    } else {
      setSelectedItems(menuItems.map(item => item.id));
      setShowBulkActions(true);
    }
  };

  // Update bulk actions visibility when selection changes
  React.useEffect(() => {
    setShowBulkActions(selectedItems.length > 0);
  }, [selectedItems]);

  const addVariation = () => {
    const newVariation: Variation = {
      id: `var-${Date.now()}`,
      name: '',
      price: 0,
      description: ''
    };
    setFormData({
      ...formData,
      variations: [...(formData.variations || []), newVariation]
    });
  };

  const updateVariation = (index: number, field: keyof Variation, value: string | number) => {
    const updatedVariations = [...(formData.variations || [])];
    updatedVariations[index] = { ...updatedVariations[index], [field]: value };
    setFormData({ ...formData, variations: updatedVariations });
  };

  const removeVariation = (index: number) => {
    const updatedVariations = formData.variations?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, variations: updatedVariations });
  };

  // Custom Fields Management
  const addCustomField = () => {
    const newField: CustomField = {
      label: '',
      key: '',
      required: false,
      placeholder: ''
    };
    setFormData({
      ...formData,
      customFields: [...(formData.customFields || []), newField]
    });
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: string | boolean) => {
    const updatedFields = [...(formData.customFields || [])];
    updatedFields[index] = { ...updatedFields[index], [field]: value };
    // Auto-generate key from label if key is empty
    if (field === 'label' && !updatedFields[index].key) {
      updatedFields[index].key = value.toString().toLowerCase().replace(/\s+/g, '_');
    }
    setFormData({ ...formData, customFields: updatedFields });
  };

  const removeCustomField = (index: number) => {
    const updatedFields = formData.customFields?.filter((_, i) => i !== index) || [];
    setFormData({ ...formData, customFields: updatedFields });
  };


  // Dashboard Stats
  const totalItems = menuItems.length;
  const popularItems = menuItems.filter(item => item.popular).length;
  const availableItems = menuItems.filter(item => item.available).length;
  const categoryCounts = categories.map(cat => ({
    ...cat,
    count: menuItems.filter(item => item.category === cat.id).length
  }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Fetch latest password from database before checking
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'admin_password')
        .single();

      const currentPassword = error ? adminPassword : (data?.value || adminPassword);

      if (password === currentPassword) {
        setIsAuthenticated(true);
        localStorage.setItem('beracah_admin_auth', 'true');
        setLoginError('');
        setPassword('');
        if (data?.value) {
          setAdminPassword(data.value);
        }
      } else {
        setLoginError('Invalid password');
      }
    } catch (err) {
      // Fallback to stored password on error
      if (password === adminPassword) {
        setIsAuthenticated(true);
        localStorage.setItem('beracah_admin_auth', 'true');
        setLoginError('');
        setPassword('');
      } else {
        setLoginError('Invalid password');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('beracah_admin_auth');
    setPassword('');
    setCurrentView('dashboard');
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-playfair font-semibold text-black">Admin Access</h1>
            <p className="text-gray-600 mt-2">Enter password to access the admin dashboard</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-black mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Enter admin password"
                required
              />
              {loginError && (
                <p className="text-red-500 text-sm mt-2">{loginError}</p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Form View (Add/Edit)
  if (currentView === 'add' || currentView === 'edit') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back</span>
                </button>
                <h1 className="text-2xl font-playfair font-semibold text-black">
                  {currentView === 'add' ? 'Add New Item' : 'Edit Item'}
                </h1>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Item Name (Game Name) *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Enter game name (e.g., Wild Rift, Mobile Legends)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Category *</label>
                <select
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.popular || false}
                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-black">Mark as Popular</span>
                </label>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.available ?? true}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-black">Available for Order</span>
                </label>
              </div>
            </div>

            {/* Discount Pricing Section */}
            <div className="mb-8">
              <h3 className="text-lg font-playfair font-medium text-black mb-4">Discount (Percentage)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discountPercentage || ''}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: Number(e.target.value) || undefined })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Enter discount percentage (e.g., 10 for 10%)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This percentage will be applied to all currency packages for this item.
                  </p>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.discountActive || false}
                      onChange={(e) => setFormData({ ...formData, discountActive: e.target.checked })}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-black">Enable Discount</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">Discount Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.discountStartDate || ''}
                    onChange={(e) => setFormData({ ...formData, discountStartDate: e.target.value || undefined })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">Discount End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.discountEndDate || ''}
                    onChange={(e) => setFormData({ ...formData, discountEndDate: e.target.value || undefined })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Leave dates empty for indefinite discount period. Discount will only be active if "Enable Discount" is checked and current time is within the date range. The percentage discount will be applied to all currency package prices.
              </p>
            </div>


            <div className="mb-8">
              <ImageUpload
                currentImage={formData.image}
                onImageChange={(imageUrl) => setFormData({ ...formData, image: imageUrl })}
              />
            </div>

            {/* In-Game Currency Packages Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-playfair font-medium text-black">In-Game Currency Packages</h3>
                  <p className="text-sm text-gray-500 mt-1">Add currency packages that will be shown when customers click on this item</p>
                </div>
                <button
                  onClick={addVariation}
                  className="flex items-center space-x-2 px-3 py-2 bg-cream-100 text-black rounded-lg hover:bg-cream-200 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Currency Package</span>
                </button>
              </div>

              {formData.variations && formData.variations.length > 0 ? (
                formData.variations.map((variation, index) => (
                  <div key={variation.id} className="mb-3 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={variation.name || ''}
                        onChange={(e) => updateVariation(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Currency package name (e.g., 5 Diamonds, 11 Diamonds, 301 Diamonds)"
                      />
                      <input
                        type="number"
                        value={variation.price || ''}
                        onChange={(e) => {
                          let value = e.target.value;
                          // Remove leading zeros (but keep single 0 if that's all there is)
                          if (value.length > 1 && value.startsWith('0') && value[1] !== '.') {
                            value = value.replace(/^0+/, '') || '0';
                          }
                          const numValue = value === '' ? 0 : parseFloat(value) || 0;
                          updateVariation(index, 'price', numValue);
                        }}
                        className="w-32 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Price (₱)"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() => removeVariation(index)}
                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={variation.description || ''}
                      onChange={(e) => updateVariation(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Package description (optional)"
                      rows={2}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">No currency packages added yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Currency Package" to add in-game currency options</p>
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-playfair font-medium text-black">Customer Information Fields</h3>
                  <p className="text-sm text-gray-500 mt-1">Define custom fields that will appear in the customer information section during checkout for this game</p>
                </div>
                <button
                  onClick={addCustomField}
                  className="flex items-center space-x-2 px-3 py-2 bg-cream-100 text-black rounded-lg hover:bg-cream-200 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Field</span>
                </button>
              </div>

              {formData.customFields && formData.customFields.length > 0 ? (
                formData.customFields.map((customField, index) => (
                  <div key={index} className="mb-3 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Field Label *</label>
                      <input
                        type="text"
                        value={customField.label || ''}
                        onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="e.g., ID with tag, UID, Server"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-black mb-1">Placeholder Text</label>
                      <input
                        type="text"
                        value={customField.placeholder || ''}
                        onChange={(e) => updateCustomField(index, 'placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="e.g., ID with tag (If Riot ID)"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={customField.required || false}
                          onChange={(e) => updateCustomField(index, 'required', e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-black">Required Field</span>
                      </label>
                      <button
                        onClick={() => removeCustomField(index)}
                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">No custom fields added yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Field" to create custom customer information fields</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Items List View
  if (currentView === 'items') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Dashboard</span>
                </button>
                <h1 className="text-2xl font-playfair font-semibold text-black">Menu Items</h1>
              </div>
              <div className="flex items-center space-x-3">
                {showBulkActions && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedItems.length} item(s) selected
                    </span>
                    <button
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                    >
                      <span>Bulk Actions</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={handleAddItem}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Item</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Bulk Actions Panel */}
          {showBulkActions && selectedItems.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border-l-4 border-blue-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-black mb-1">Bulk Actions</h3>
                  <p className="text-sm text-gray-600">{selectedItems.length} item(s) selected</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Change Category */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Change Category:</label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBulkCategoryChange(e.target.value);
                          e.target.value = ''; // Reset selection
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={isProcessing}
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Remove Items */}
                  <button
                    onClick={handleBulkRemove}
                    disabled={isProcessing}
                    className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{isProcessing ? 'Removing...' : 'Remove Selected'}</span>
                  </button>
                  
                  {/* Clear Selection */}
                  <button
                    onClick={() => {
                      setSelectedItems([]);
                      setShowBulkActions(false);
                    }}
                    className="flex items-center space-x-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 text-sm"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear Selection</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Bulk Actions Bar */}
            {menuItems.length > 0 && (
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === menuItems.length && menuItems.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Select All ({menuItems.length} items)
                      </span>
                    </label>
                  </div>
                  {selectedItems.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {selectedItems.length} item(s) selected
                      </span>
                      <button
                        onClick={() => setSelectedItems([])}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">
                      Select
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Category</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Currency Packages</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {menuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {categories.find(cat => cat.id === item.category)?.name}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex flex-col">
                          {item.isOnDiscount && item.discountPrice ? (
                            <>
                              <span className="text-red-600 font-semibold">₱{item.discountPrice}</span>
                              <span className="text-gray-500 line-through text-xs">₱{item.basePrice}</span>
                            </>
                          ) : (
                            <span>₱{item.basePrice}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.variations?.length || 0} package{item.variations?.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          {item.popular && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                              Popular
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.available 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            disabled={isProcessing}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isProcessing}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden">
              {menuItems.map((item) => (
                <div key={item.id} className={`p-4 border-b border-gray-200 last:border-b-0 ${selectedItems.includes(item.id) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-600">Select</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditItem(item)}
                        disabled={isProcessing}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors duration-200"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={isProcessing}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-1 text-gray-900">
                        {categories.find(cat => cat.id === item.category)?.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Price:</span>
                      <span className="ml-1 font-medium text-gray-900">
                        {item.isOnDiscount && item.discountPrice ? (
                          <span className="text-red-600">₱{item.discountPrice}</span>
                        ) : (
                          `₱${item.basePrice}`
                        )}
                        {item.isOnDiscount && item.discountPrice && (
                          <span className="text-gray-500 line-through text-xs ml-1">₱{item.basePrice}</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Currency Packages:</span>
                      <span className="ml-1 text-gray-900">{item.variations?.length || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2">
                      {item.popular && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-600 text-white">
                          Popular
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Categories View
  if (currentView === 'categories') {
    return <CategoryManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Payment Methods View
  if (currentView === 'payments') {
    return <PaymentMethodManager onBack={() => setCurrentView('dashboard')} />;
  }

  // Site Settings View
  if (currentView === 'settings') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Dashboard</span>
                </button>
                <h1 className="text-2xl font-playfair font-semibold text-black">Site Settings</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <SiteSettingsManager />
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-noto font-semibold text-black">Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-600 hover:text-black transition-colors duration-200"
              >
                View Website
              </a>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-black transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-600 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-semibold text-gray-900">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Items</p>
                <p className="text-2xl font-semibold text-gray-900">{availableItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-cream-500 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Popular Items</p>
                <p className="text-2xl font-semibold text-gray-900">{popularItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-semibold text-gray-900">Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-playfair font-medium text-black mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={handleAddItem}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Plus className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">Add New Menu Item</span>
              </button>
              <button
                onClick={() => setCurrentView('items')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Package className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">Manage Menu Items</span>
              </button>
              <button
                onClick={() => setCurrentView('categories')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <FolderOpen className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">Manage Categories</span>
              </button>
              <button
                onClick={() => setCurrentView('payments')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <CreditCard className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">Payment Methods</span>
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
              >
                <Settings className="h-5 w-5 text-gray-400" />
                <span className="font-medium text-gray-900">Site Settings</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-playfair font-medium text-black mb-4">Categories Overview</h3>
            <div className="space-y-3">
              {categoryCounts.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{category.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{category.count} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;