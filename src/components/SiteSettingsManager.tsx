import React, { useState } from 'react';
import { Save, Upload, X, Lock, Eye, EyeOff } from 'lucide-react';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useImageUpload } from '../hooks/useImageUpload';
import { supabase } from '../lib/supabase';

interface SiteSettingsManagerProps {
  onTestNotificationSound?: () => void;
}

const SiteSettingsManager: React.FC<SiteSettingsManagerProps> = ({ onTestNotificationSound }) => {
  const { siteSettings, loading, updateSiteSettings } = useSiteSettings();
  const { uploadImage, uploading } = useImageUpload();
  const [formData, setFormData] = useState({
    site_name: '',
    site_description: '',
    currency: '',
    currency_code: '',
    footer_social_1: '',
    footer_social_2: '',
    footer_social_3: '',
    footer_social_4: '',
    footer_support_url: '',
    order_option: 'order_via_messenger' as 'order_via_messenger' | 'place_order'
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  // Hero images state
  const [heroImages, setHeroImages] = useState<{
    hero_image_1: string;
    hero_image_2: string;
    hero_image_3: string;
    hero_image_4: string;
    hero_image_5: string;
  }>({
    hero_image_1: '',
    hero_image_2: '',
    hero_image_3: '',
    hero_image_4: '',
    hero_image_5: '',
  });
  const [heroFiles, setHeroFiles] = useState<{[key: string]: File | null}>({
    hero_image_1: null,
    hero_image_2: null,
    hero_image_3: null,
    hero_image_4: null,
    hero_image_5: null,
  });
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  React.useEffect(() => {
    if (siteSettings) {
      setFormData({
        site_name: siteSettings.site_name,
        site_description: siteSettings.site_description,
        currency: siteSettings.currency,
        currency_code: siteSettings.currency_code,
        footer_social_1: siteSettings.footer_social_1 || '',
        footer_social_2: siteSettings.footer_social_2 || '',
        footer_social_3: siteSettings.footer_social_3 || '',
        footer_social_4: siteSettings.footer_social_4 || '',
        footer_support_url: siteSettings.footer_support_url || '',
        order_option: siteSettings.order_option || 'order_via_messenger'
      });
      setLogoPreview(siteSettings.site_logo);
      setHeroImages({
        hero_image_1: siteSettings.hero_image_1 || '',
        hero_image_2: siteSettings.hero_image_2 || '',
        hero_image_3: siteSettings.hero_image_3 || '',
        hero_image_4: siteSettings.hero_image_4 || '',
        hero_image_5: siteSettings.hero_image_5 || '',
      });
    }
  }, [siteSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeroImageChange = (imageKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeroFiles(prev => ({ ...prev, [imageKey]: file }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setHeroImages(prev => ({ ...prev, [imageKey]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveHeroImage = (imageKey: string) => {
    setHeroImages(prev => ({ ...prev, [imageKey]: '' }));
    setHeroFiles(prev => ({ ...prev, [imageKey]: null }));
  };

  const handleSave = async () => {
    try {
      let logoUrl = logoPreview;
      
      // Upload new logo if selected
      if (logoFile) {
        const uploadedUrl = await uploadImage(logoFile, 'site-logo');
        logoUrl = uploadedUrl;
      }

      // Upload hero images if selected
      const heroImageUrls: Record<string, string> = { ...heroImages };
      for (const key of Object.keys(heroFiles)) {
        if (heroFiles[key]) {
          const uploadedUrl = await uploadImage(heroFiles[key]!, 'hero-images');
          heroImageUrls[key] = uploadedUrl;
        }
      }

      // Update all settings
      await updateSiteSettings({
        site_name: formData.site_name,
        site_description: formData.site_description,
        currency: formData.currency,
        currency_code: formData.currency_code,
        site_logo: logoUrl,
        footer_social_1: formData.footer_social_1,
        footer_social_2: formData.footer_social_2,
        footer_social_3: formData.footer_social_3,
        footer_social_4: formData.footer_social_4,
        footer_support_url: formData.footer_support_url,
        order_option: formData.order_option,
        hero_image_1: heroImageUrls.hero_image_1,
        hero_image_2: heroImageUrls.hero_image_2,
        hero_image_3: heroImageUrls.hero_image_3,
        hero_image_4: heroImageUrls.hero_image_4,
        hero_image_5: heroImageUrls.hero_image_5,
      });

      setLogoFile(null);
      setHeroFiles({
        hero_image_1: null,
        hero_image_2: null,
        hero_image_3: null,
        hero_image_4: null,
        hero_image_5: null,
      });
    } catch (error) {
      console.error('Error saving site settings:', error);
    }
  };

  const handleCancel = () => {
    if (siteSettings) {
      setFormData({
        site_name: siteSettings.site_name,
        site_description: siteSettings.site_description,
        currency: siteSettings.currency,
        currency_code: siteSettings.currency_code,
        footer_social_1: siteSettings.footer_social_1 || '',
        footer_social_2: siteSettings.footer_social_2 || '',
        footer_social_3: siteSettings.footer_social_3 || '',
        footer_social_4: siteSettings.footer_social_4 || '',
        footer_support_url: siteSettings.footer_support_url || ''
      });
      setLogoPreview(siteSettings.site_logo);
      setHeroImages({
        hero_image_1: siteSettings.hero_image_1 || '',
        hero_image_2: siteSettings.hero_image_2 || '',
        hero_image_3: siteSettings.hero_image_3 || '',
        hero_image_4: siteSettings.hero_image_4 || '',
        hero_image_5: siteSettings.hero_image_5 || '',
      });
      setHeroFiles({
        hero_image_1: null,
        hero_image_2: null,
        hero_image_3: null,
        hero_image_4: null,
        hero_image_5: null,
      });
    }
    setLogoFile(null);
  };

  // Password change handlers
  const handlePasswordInputChange = (field: keyof typeof passwordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    setIsChangingPassword(true);

    try {
      // Validation
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setPasswordError('All fields are required');
        setIsChangingPassword(false);
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters long');
        setIsChangingPassword(false);
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('New passwords do not match');
        setIsChangingPassword(false);
        return;
      }

      // Fetch current password from database
      const { data: currentPasswordData, error: fetchError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('id', 'admin_password')
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch current password');
      }

      const currentPassword = currentPasswordData?.value || 'Diginix@Admin!2025';

      // Verify current password
      if (passwordData.currentPassword !== currentPassword) {
        setPasswordError('Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      // Update password in database
      const { error: updateError } = await supabase
        .from('site_settings')
        .update({ value: passwordData.newPassword })
        .eq('id', 'admin_password');

      if (updateError) {
        throw new Error('Failed to update password');
      }

      // Success
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordSection(false);

      // Reset success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError('');
    setPasswordSuccess('');
    setShowPasswordSection(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-black">Site Settings</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleCancel}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{uploading ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Site Logo */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Site Logo
          </label>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Site Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-xs text-gray-400">☕</div>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Logo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Site Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Site Name
          </label>
          {isEditing ? (
            <input
              type="text"
              name="site_name"
              value={formData.site_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
              placeholder="Enter site name"
            />
          ) : (
            <p className="text-lg font-medium text-black">{siteSettings?.site_name}</p>
          )}
        </div>

        {/* Currency Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Currency Symbol
            </label>
            {isEditing ? (
              <input
                type="text"
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                placeholder="e.g., ₱, $, €"
              />
            ) : (
              <p className="text-lg font-medium text-black">{siteSettings?.currency}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Currency Code
            </label>
            {isEditing ? (
              <input
                type="text"
                name="currency_code"
                value={formData.currency_code}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                placeholder="e.g., PHP, USD, EUR"
              />
            ) : (
              <p className="text-lg font-medium text-black">{siteSettings?.currency_code}</p>
            )}
          </div>
        </div>

        {/* Footer Links */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-xs font-semibold text-black mb-4">Footer Links</h3>
          <p className="text-xs text-gray-600 mb-4">
            Configure social media links and customer support link for the footer. Leave blank to hide an item.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Link 1 (Facebook)</label>
              {isEditing ? (
                <input
                  type="url"
                  name="footer_social_1"
                  value={formData.footer_social_1}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  placeholder="https://facebook.com/yourpage"
                />
              ) : (
                <p className="text-gray-600 break-all">{siteSettings?.footer_social_1 || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Link 2 (Instagram)</label>
              {isEditing ? (
                <input
                  type="url"
                  name="footer_social_2"
                  value={formData.footer_social_2}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  placeholder="https://instagram.com/yourhandle"
                />
              ) : (
                <p className="text-gray-600 break-all">{siteSettings?.footer_social_2 || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Link 3 (Twitter/X)</label>
              {isEditing ? (
                <input
                  type="url"
                  name="footer_social_3"
                  value={formData.footer_social_3}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  placeholder="https://x.com/yourhandle"
                />
              ) : (
                <p className="text-gray-600 break-all">{siteSettings?.footer_social_3 || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Link 4 (YouTube)</label>
              {isEditing ? (
                <input
                  type="url"
                  name="footer_social_4"
                  value={formData.footer_social_4}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  placeholder="https://youtube.com/@yourchannel"
                />
              ) : (
                <p className="text-gray-600 break-all">{siteSettings?.footer_social_4 || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer Support URL</label>
              {isEditing ? (
                <input
                  type="url"
                  name="footer_support_url"
                  value={formData.footer_support_url}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                  placeholder="https://yourwebsite.com/support or tel:+1234567890"
                />
              ) : (
                <p className="text-gray-600 break-all">{siteSettings?.footer_support_url || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Order Option */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-xs font-semibold text-black mb-4">Order Option</h3>
          <p className="text-xs text-gray-600 mb-4">
            Choose how customers can place orders. "Order via Messenger" shows receipt upload, copy message, and messenger button. "Place Order" shows only receipt upload and place order button.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Order Method
              </label>
              {isEditing ? (
                <select
                  name="order_option"
                  value={formData.order_option}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                >
                  <option value="order_via_messenger">Order via Messenger</option>
                  <option value="place_order">Place Order</option>
                </select>
              ) : (
                <p className="text-gray-600">
                  {siteSettings?.order_option === 'place_order' ? 'Place Order' : 'Order via Messenger'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Hero Slideshow Images */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-black mb-2">Hero Slideshow Images</h3>
          <p className="text-xs text-gray-600 mb-4">
            Upload up to 5 images for the hero slideshow on the customer page (shown when viewing &quot;All&quot; category). Images are stored in Supabase storage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(['hero_image_1', 'hero_image_2', 'hero_image_3', 'hero_image_4', 'hero_image_5'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  {key.replace('hero_image_', 'Image ')}
                </label>
                <div className="flex items-start gap-2">
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {heroImages[key] ? (
                      <img
                        src={heroImages[key]}
                        alt={key}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleHeroImageChange(key, e)}
                      className="hidden"
                      id={`hero-${key}`}
                    />
                    <label
                      htmlFor={`hero-${key}`}
                      className="bg-gray-100 text-gray-700 px-2 py-1.5 rounded text-xs hover:bg-gray-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </label>
                    {heroImages[key] && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHeroImage(key)}
                        className="text-red-600 hover:text-red-700 text-xs flex items-center justify-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-black mb-4">Notification Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Volume (0.0 - 1.0)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  name="notification_volume"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.notification_volume}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                />
              ) : (
                <p className="text-gray-600">
                  {siteSettings?.notification_volume ?? 0.5}
                </p>
              )}
            </div>
            {onTestNotificationSound && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test sound</label>
                <button
                  type="button"
                  onClick={onTestNotificationSound}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                  Play notification sound
                </button>
                <p className="mt-1 text-xs text-gray-500">Optional: verify sound works. First click anywhere in admin activates notifications.</p>
              </div>
            )}
          </div>
        </div>

        {/* Password Change Section */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-gray-600" />
              <h3 className="text-xs font-semibold text-black">Admin Password</h3>
            </div>
            {!showPasswordSection && (
              <button
                onClick={() => setShowPasswordSection(true)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-2"
              >
                <Lock className="h-4 w-4" />
                <span>Change Password</span>
              </button>
            )}
          </div>

          {showPasswordSection && (
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                  {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    name="admin_current_password"
                    autoComplete="off"
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="admin_new_password"
                    autoComplete="new-password"
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                    placeholder="Enter new password (min. 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="admin_confirm_password"
                    autoComplete="new-password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-black"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={handleCancelPasswordChange}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiteSettingsManager;
