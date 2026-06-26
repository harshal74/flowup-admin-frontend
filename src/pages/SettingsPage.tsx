import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Save, Store, Phone, Mail, MapPin, MessageCircle, Star,
  ToggleLeft, ToggleRight, Loader2, Camera, Clock,
  IndianRupee, Timer, ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRestaurant } from '../context/RestaurantContext';

export function SettingsPage() {
  const { restaurant, isLoading, updateRestaurant, toggleOpen, toggleFeedback, toggleWhatsapp } = useRestaurant();

  const [formData, setFormData] = useState({
    restaurantName: '',
    restaurantDescription: '',
    restaurantLogo: '',
    whatsappNumber: '',
    contactNumber: '',
    email: '',
    address: '',
    deliveryCharge: 0,
    minimumOrderAmount: 0,
    averagePreparationTime: 20,
    openingTime: '09:00',
    closingTime: '23:00',
    currency: 'INR',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setFormData({
        restaurantName:        restaurant.restaurantName        || '',
        restaurantDescription: restaurant.restaurantDescription || '',
        restaurantLogo:        restaurant.restaurantLogo        || '',
        whatsappNumber:        restaurant.whatsappNumber        || '',
        contactNumber:         restaurant.contactNumber         || '',
        email:                 restaurant.email                 || '',
        address:               restaurant.address               || '',
        deliveryCharge:        restaurant.deliveryCharge        ?? 0,
        minimumOrderAmount:    restaurant.minimumOrderAmount    ?? 0,
        averagePreparationTime: restaurant.averagePreparationTime ?? 20,
        openingTime:           restaurant.openingTime           || '09:00',
        closingTime:           restaurant.closingTime           || '23:00',
        currency:              restaurant.currency              || 'INR',
      });
    }
  }, [restaurant]);

  const set = (key: string, value: any) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const result = await updateRestaurant(formData);
    if (result.success) toast.success('Settings saved successfully');
    else toast.error(result.error || 'Failed to save settings');
    setIsSaving(false);
  };

  const handleToggleRestaurant = async () => {
    const wasOpen = restaurant?.shopOpen;
    await toggleOpen();
    toast.success(wasOpen ? 'Restaurant closed' : 'Restaurant opened');
  };

  const handleToggleFeedback = async () => {
    const wasEnabled = restaurant?.feedbackEnabled;
    await toggleFeedback();
    toast.success(wasEnabled ? 'Feedback disabled' : 'Feedback enabled');
  };

  const handleToggleWhatsapp = async () => {
    const wasEnabled = restaurant?.whatsappNotificationsEnabled;
    await toggleWhatsapp();
    toast.success(wasEnabled ? 'WhatsApp disabled' : 'WhatsApp enabled');
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="card p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 w-full" />)}
      </div>
    </div>
  );

  const ToggleCard = ({
    icon: Icon, iconBgActive, iconColorActive, iconBgInactive, iconColorInactive,
    label, activeText, inactiveText, activeTextColor, inactiveTextColor,
    toggleColor, isOn, onToggle,
  }: any) => (
    <div className="p-4 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOn ? iconBgActive : iconBgInactive}`}>
            <Icon className={`w-5 h-5 ${isOn ? iconColorActive : iconColorInactive}`} />
          </div>
          <div>
            <p className="font-medium text-secondary-900 dark:text-white">{label}</p>
            <p className={`text-sm ${isOn ? activeTextColor : inactiveTextColor}`}>{isOn ? activeText : inactiveText}</p>
          </div>
        </div>
        <button type="button" onClick={onToggle} className={`p-1 transition-transform ${isOn ? toggleColor : 'text-secondary-400'}`}>
          {isOn ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Settings</h1>
        <p className="text-secondary-500 dark:text-secondary-400">Manage your restaurant settings</p>
      </div>

      {/* ── Quick Toggles ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">Quick Controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ToggleCard
            icon={Store}
            iconBgActive="bg-success-100 dark:bg-success-900/30"
            iconColorActive="text-success-600"
            iconBgInactive="bg-danger-100 dark:bg-danger-900/30"
            iconColorInactive="text-danger-600"
            label="Restaurant"
            activeText="Open"
            inactiveText="Closed"
            activeTextColor="text-success-600"
            inactiveTextColor="text-danger-600"
            toggleColor="text-success-500"
            isOn={restaurant?.shopOpen}
            onToggle={handleToggleRestaurant}
          />
          <ToggleCard
            icon={Star}
            iconBgActive="bg-primary-100 dark:bg-primary-900/30"
            iconColorActive="text-primary-600"
            iconBgInactive="bg-secondary-200 dark:bg-secondary-600"
            iconColorInactive="text-secondary-400"
            label="Feedback"
            activeText="Enabled"
            inactiveText="Disabled"
            activeTextColor="text-primary-600"
            inactiveTextColor="text-secondary-500"
            toggleColor="text-primary-500"
            isOn={restaurant?.feedbackEnabled}
            onToggle={handleToggleFeedback}
          />
          <ToggleCard
            icon={MessageCircle}
            iconBgActive="bg-success-100 dark:bg-success-900/30"
            iconColorActive="text-success-600"
            iconBgInactive="bg-secondary-200 dark:bg-secondary-600"
            iconColorInactive="text-secondary-400"
            label="WhatsApp"
            activeText="Enabled"
            inactiveText="Disabled"
            activeTextColor="text-success-600"
            inactiveTextColor="text-secondary-500"
            toggleColor="text-success-500"
            isOn={restaurant?.whatsappNotificationsEnabled}
            onToggle={handleToggleWhatsapp}
          />
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Restaurant Info ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-6">Restaurant Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Restaurant Name *</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="text" value={formData.restaurantName} onChange={(e) => set('restaurantName', e.target.value)} className="input pl-12" placeholder="My Restaurant" required />
              </div>
            </div>

            <div>
              <label className="label">Logo URL</label>
              <div className="relative">
                <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="url" value={formData.restaurantLogo} onChange={(e) => set('restaurantLogo', e.target.value)} className="input pl-12" placeholder="https://example.com/logo.png" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea value={formData.restaurantDescription} onChange={(e) => set('restaurantDescription', e.target.value)} className="input min-h-[90px]" placeholder="Describe your restaurant…" />
            </div>

            <div>
              <label className="label">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="tel" value={formData.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} className="input pl-12" placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            <div>
              <label className="label">WhatsApp Number</label>
              <div className="relative">
                <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="tel" value={formData.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} className="input pl-12" placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="email" value={formData.email} onChange={(e) => set('email', e.target.value)} className="input pl-12" placeholder="restaurant@example.com" />
              </div>
            </div>

            <div>
              <label className="label">Currency</label>
              <select value={formData.currency} onChange={(e) => set('currency', e.target.value)} className="input">
                <option value="INR">INR – Indian Rupee (₹)</option>
                <option value="USD">USD – US Dollar ($)</option>
                <option value="EUR">EUR – Euro (€)</option>
                <option value="GBP">GBP – British Pound (£)</option>
                <option value="AED">AED – UAE Dirham</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="text" value={formData.address} onChange={(e) => set('address', e.target.value)} className="input pl-12" placeholder="123 Food Street, City, State" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Operational Settings ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-6">Operational Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Opening Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="time" value={formData.openingTime} onChange={(e) => set('openingTime', e.target.value)} className="input pl-12" />
              </div>
            </div>

            <div>
              <label className="label">Closing Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input type="time" value={formData.closingTime} onChange={(e) => set('closingTime', e.target.value)} className="input pl-12" />
              </div>
            </div>

            <div>
              <label className="label">Average Preparation Time (minutes)</label>
              <div className="relative">
                <Timer className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="number" min={1} max={120}
                  value={formData.averagePreparationTime}
                  onChange={(e) => set('averagePreparationTime', Number(e.target.value))}
                  className="input pl-12" placeholder="20"
                />
              </div>
            </div>

            <div>
              <label className="label">Delivery Charge (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="number" min={0} step={0.5}
                  value={formData.deliveryCharge}
                  onChange={(e) => set('deliveryCharge', Number(e.target.value))}
                  className="input pl-12" placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="label">Minimum Order Amount (₹)</label>
              <div className="relative">
                <ShoppingCart className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                <input
                  type="number" min={0} step={1}
                  value={formData.minimumOrderAmount}
                  onChange={(e) => set('minimumOrderAmount', Number(e.target.value))}
                  className="input pl-12" placeholder="0"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Save ── */}
        <div className="flex justify-end pb-4">
          <button type="submit" disabled={isSaving} className="btn btn-primary px-8">
            {isSaving
              ? <><Loader2 className="w-5 h-5 animate-spin" />Saving…</>
              : <><Save className="w-5 h-5" />Save Changes</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
