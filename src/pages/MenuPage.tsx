import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Leaf, Flame, Star, Image, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import API from "../lib/api";
import type { MenuItem, Category } from '../types';

export function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterVeg, setFilterVeg] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
 const [formData, setFormData] = useState({
  name: "",
  description: "",
  image: "",
  price: "",
  discountedPrice: "",
  categoryId: "",
  isVeg: true,
  isAvailable: true,
  isRecommended: false,
});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
  try {
    setIsLoading(true);

    const [menuRes, categoryRes] =
      await Promise.all([
        API.get("/menu/admin"),
        API.get("/categories"),
      ]);

    setMenuItems(
      menuRes.data.data || []
    );

    setCategories(
      categoryRes.data.data || []
    );
  } catch (error) {
    console.error(error);
    toast.error(
      "Failed to load menu"
    );
  } finally {
    setIsLoading(false);
  }
};

  const handleSubmit = async (
  e: React.FormEvent
) => {
  e.preventDefault();

  try {
    const itemData = {
      name: formData.name,
      description:
        formData.description,
      image: formData.image,
      price: Number(
        formData.price
      ),
      discountedPrice:
        formData.discountedPrice
          ? Number(
              formData.discountedPrice
            )
          : null,
      categoryId:
        formData.categoryId,
      isVeg:
        formData.isVeg,
      isAvailable:
        formData.isAvailable,
      isRecommended:
        formData.isRecommended,
    };

    if (editingItem) {
      await API.put(
        `/menu/${editingItem._id}`,
        itemData
      );

      toast.success(
        "Menu item updated"
      );
    } else {
      await API.post(
        "/menu",
        itemData
      );

      toast.success(
        "Menu item created"
      );
    }

    setShowModal(false);

    resetForm();

    fetchData();
  } catch (error) {
    console.error(error);

    toast.error(
      "Failed to save menu item"
    );
  }
};

  const handleDelete = async (
  id: string
) => {
  if (
    !confirm(
      "Delete this item?"
    )
  )
    return;

  try {
    await API.delete(
      `/menu/${id}`
    );

    toast.success(
      "Menu item deleted"
    );

    fetchData();
  } catch (error) {
    toast.error(
      "Failed to delete item"
    );
  }
};

  const handleToggleAvailability =
  async (
    item: MenuItem
  ) => {
    try {
      await API.patch(
        `/menu/${item._id}/availability`
      );

      toast.success(
        "Availability updated"
      );

      fetchData();
    } catch (error) {
      toast.error(
        "Failed to update availability"
      );
    }
  };

  const handleToggleRecommendation =
  async (
    item: MenuItem
  ) => {
    try {
      await API.patch(
        `/menu/${item._id}/recommendation`
      );

      toast.success(
        "Recommendation updated"
      );

      fetchData();
    } catch (error) {
      toast.error(
        "Failed to update recommendation"
      );
    }
  };

  const resetForm = () => { setFormData({ name: '', description: '', image: '', price: '', discountedPrice: '', categoryId: '', isVeg: true, isAvailable: true, isRecommended: false }); setEditingItem(null); };
  const openEditModal = (item: MenuItem) => { setEditingItem(item); setFormData({ name: item.name, description: item.description || '', image: item.image || '', price: item.price.toString(), discountedPrice: item.discountedPrice?.toString() || '', categoryId: item.categoryId || '', isVeg: item.isVeg, isAvailable: item.isAvailable, isRecommended: item.isRecommended }); setShowModal(true); };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || item.categoryId === filterCategory;
    const matchesVeg = !filterVeg || (filterVeg === 'veg' ? item.isVeg : !item.isVeg);
    return matchesSearch && matchesCategory && matchesVeg;
  });

  const hasActiveFilters = filterCategory || filterVeg;
  const clearFilters = () => { setFilterCategory(''); setFilterVeg(''); setSearchQuery(''); };

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="flex gap-4"><div className="skeleton h-10 w-64" /><div className="skeleton h-10 w-32" /></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="card p-4"><div className="skeleton h-40 w-full mb-4" /><div className="skeleton h-4 w-24 mb-2" /><div className="skeleton h-3 w-full" /></div>)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Menu</h1><p className="text-secondary-500 dark:text-secondary-400">Manage your menu items</p></div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary"><Plus className="w-5 h-5" />Add Item</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search menu items..." className="input pl-12" /></div>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn ${hasActiveFilters ? 'btn-primary' : 'btn-secondary'}`}><Filter className="w-5 h-5" />Filters{hasActiveFilters && <span className="w-5 h-5 rounded-full bg-white text-primary-500 flex items-center justify-center text-xs font-bold">!</span>}</button>
        {hasActiveFilters && <button onClick={clearFilters} className="btn btn-secondary"><X className="w-5 h-5" />Clear</button>}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="label">Category</label><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input"><option value="">All Categories</option>{categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}</select></div>
              <div><label className="label">Dietary</label><select value={filterVeg} onChange={(e) => setFilterVeg(e.target.value)} className="input"><option value="">All</option><option value="veg">Vegetarian</option><option value="non-veg">Non-Vegetarian</option></select></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredItems.length === 0 ? (
        <div className="card p-12 text-center"><Image className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600 mb-4" /><h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">No menu items found</h3><p className="text-secondary-500 dark:text-secondary-400 mb-4">{hasActiveFilters || searchQuery ? 'Try different filters' : 'Add your first menu item'}</p><button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus className="w-5 h-5" />Add Item</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredItems.map((item, index) => (
              <motion.div key={item._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: index * 0.03 }} className={`card overflow-hidden group ${!item.isAvailable ? 'opacity-60' : ''}`}>
                <div className="relative h-40 bg-secondary-100 dark:bg-secondary-700">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><Image className="w-12 h-12 text-secondary-300 dark:text-secondary-600" /></div>}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center ${item.isVeg ? 'bg-success-500' : 'bg-danger-500'}`}>{item.isVeg ? <Leaf className="w-4 h-4 text-white" /> : <Flame className="w-4 h-4 text-white" />}</span>
                    {item.isRecommended && <span className="bg-warning-500 rounded-full p-1"><Star className="w-4 h-4 text-white fill-white" /></span>}
                  </div>
                  {!item.isAvailable && <div className="absolute inset-0 bg-secondary-900/50 flex items-center justify-center"><span className="badge bg-secondary-800 text-white">Unavailable</span></div>}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div><h3 className="font-semibold text-secondary-900 dark:text-white">{item.name}</h3>{item.category && <p className="text-xs text-secondary-500">{item.category.name}</p>}</div>
                    <div className="text-right">{item.discountedPrice ? <><p className="text-sm text-secondary-400 line-through">₹{item.price}</p><p className="font-bold text-success-600">₹{item.discountedPrice}</p></> : <p className="font-bold text-secondary-900 dark:text-white">₹{item.price}</p>}</div>
                  </div>
                  {item.description && <p className="text-sm text-secondary-500 dark:text-secondary-400 line-clamp-2 mb-4">{item.description}</p>}
                  <div className="flex items-center justify-between pt-3 border-t border-secondary-100 dark:border-secondary-700">
                    <div className="flex gap-1">
                      <button onClick={() => handleToggleAvailability(item)} className={`p-2 rounded-lg transition-colors ${item.isAvailable ? 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20' : 'text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700'}`} title={item.isAvailable ? 'Mark unavailable' : 'Mark available'}><div className={`w-5 h-5 rounded-full border-2 ${item.isAvailable ? 'border-success-500 bg-success-500' : 'border-secondary-300'}`} /></button>
                      <button onClick={() => handleToggleRecommendation(item)} className={`p-2 rounded-lg transition-colors ${item.isRecommended ? 'text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20' : 'text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700'}`} title={item.isRecommended ? 'Remove from recommended' : 'Add to recommended'}><Star className={`w-4 h-4 ${item.isRecommended ? 'fill-warning-500' : ''}`} /></button>
                    </div>
                    <div className="flex gap-1"><button onClick={() => openEditModal(item)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDelete(item._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white dark:bg-secondary-800 rounded-2xl p-6 my-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="e.g., Grilled Salmon" required /></div>
                <div><label className="label">Category</label><select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} className="input"><option value="">Select Category</option>{categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}</select></div>
                <div><label className="label">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input min-h-[80px]" placeholder="Describe the dish..." /></div>
                <div><label className="label">Image URL</label><input type="url" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="input" placeholder="https://example.com/image.jpg" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Price ($)</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="input" placeholder="0.00" required /></div>
                  <div><label className="label">Discounted Price ($)</label><input type="number" step="0.01" value={formData.discountedPrice} onChange={(e) => setFormData({ ...formData, discountedPrice: e.target.value })} className="input" placeholder="Optional" /></div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="dietary" checked={formData.isVeg} onChange={() => setFormData({ ...formData, isVeg: true })} className="w-4 h-4 text-success-500" /><span className="flex items-center gap-1 text-sm"><Leaf className="w-4 h-4 text-success-500" /> Vegetarian</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="dietary" checked={!formData.isVeg} onChange={() => setFormData({ ...formData, isVeg: false })} className="w-4 h-4 text-danger-500" /><span className="flex items-center gap-1 text-sm"><Flame className="w-4 h-4 text-danger-500" /> Non-Veg</span></label>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isAvailable} onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Available</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isRecommended} onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm flex items-center gap-1"><Star className="w-4 h-4 text-warning-500" /> Recommended</span></label>
                </div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button><button type="submit" className="btn btn-primary flex-1">{editingItem ? 'Update' : 'Create'}</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
