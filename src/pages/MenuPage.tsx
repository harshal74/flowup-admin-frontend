import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Leaf, Flame, Star, Image, Filter, X, AlertTriangle, Loader2, ClipboardList, PlusSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import API from "../lib/api";
import type { MenuItem, Category } from '../types';

// ── Inventory Step 2: recipe/ingredient types (local; backend is source of truth) ──
interface RawMaterialOption {
  _id: string;
  name: string;
  unit: string;
  baseUnit: string;
  isActive: boolean;
}
interface RecipeIngredient {
  _id?: string;
  rawMaterialId: string;
  rawMaterialName?: string;
  unit?: string;       // display unit (kg/g/…)
  baseUnit?: string;   // storage/base unit the quantity is in
  quantityPerItem: number | string;
}

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
  // BUG Z FIX: replace window.confirm() with state-based modal
  const [deleteMenuTargetId, setDeleteMenuTargetId] = useState<string | null>(null);
  // Prevent double-submit: track in-flight save
  const [isSaving, setIsSaving] = useState(false);
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

  // ── Inventory Step 2: recipe/ingredient management state ──────
  const [recipeItem, setRecipeItem] = useState<MenuItem | null>(null); // menu item whose recipe is open
  const [rawMaterials, setRawMaterials] = useState<RawMaterialOption[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState('');

  // fetchData defined BEFORE the useEffect that depends on it
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [menuRes, categoryRes] = await Promise.all([
        API.get("/menu/admin"),
        API.get("/categories"),
      ]);
      setMenuItems(menuRes.data.data || []);
      setCategories(categoryRes.data.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load menu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (
  e: React.FormEvent
) => {
  e.preventDefault();

  // Prevent re-entry (double-click / rapid Enter key)
  if (isSaving) return;

  // ── Frontend validation ────────────────────────────────────
  if (!formData.categoryId) {
    toast.error("Category must be selected.");
    return;
  }

  const priceNum     = Number(formData.price);
  const discountedNum = formData.discountedPrice ? Number(formData.discountedPrice) : null;

  if (discountedNum !== null && discountedNum >= priceNum) {
    toast.error("Discounted price must be less than the actual price.");
    return;
  }

  setIsSaving(true);
  try {
    const itemData = {
      name: formData.name,
      description:
        formData.description,
      image: formData.image,
      price: priceNum,
      discountedPrice: discountedNum,
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
  } catch (error: any) {
    // Show the server's specific error message (e.g. duplicate name, validation)
    // so the user gets actionable feedback rather than a generic string.
    const serverMsg = error?.response?.data?.message;
    toast.error(serverMsg || "Failed to save menu item");
  } finally {
    setIsSaving(false);
  }
};

  const handleDelete = async (id: string) => {
    // BUG Z FIX: use state-based modal instead of window.confirm()
    setDeleteMenuTargetId(id);
  };

  const confirmDeleteMenu = async () => {
    if (!deleteMenuTargetId) return;
    const id = deleteMenuTargetId;
    setDeleteMenuTargetId(null);
    try {
      await API.delete(`/menu/${id}`);
      toast.success("Menu item deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete item");
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

  // ── Inventory Step 2: open the recipe modal for a menu item ───
  const openRecipeModal = async (item: MenuItem) => {
    setRecipeItem(item);
    setNewIngredientId('');
    setNewIngredientQty('');
    setRecipeLoading(true);
    try {
      const [rmRes, recipeRes] = await Promise.all([
        API.get('/inventory?active=true'),
        API.get(`/inventory/menu/${item._id}/ingredients`),
      ]);
      setRawMaterials(rmRes.data.data || []);
      setRecipeIngredients(
        (recipeRes.data.data || []).map((r: any) => ({
          _id: r._id,
          rawMaterialId: typeof r.rawMaterialId === 'object' ? r.rawMaterialId._id : r.rawMaterialId,
          rawMaterialName: r.rawMaterialName,
          unit: r.unit,
          baseUnit: r.baseUnit,
          quantityPerItem: r.quantityPerItem,
        }))
      );
    } catch (error) {
      toast.error('Failed to load recipe');
      setRawMaterials([]);
      setRecipeIngredients([]);
    } finally {
      setRecipeLoading(false);
    }
  };

  const closeRecipeModal = () => {
    setRecipeItem(null);
    setRecipeIngredients([]);
    setRawMaterials([]);
    setNewIngredientId('');
    setNewIngredientQty('');
    setRecipeSaving(false);
  };

  // Add a raw material to the in-progress recipe list (client-side; saved on "Save").
  const addRecipeIngredient = () => {
    if (!newIngredientId) { toast.error('Select a raw material'); return; }
    const qty = Number(newIngredientQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    if (recipeIngredients.some((r) => r.rawMaterialId === newIngredientId)) {
      toast.error('This raw material is already in the recipe');
      return;
    }
    const rm = rawMaterials.find((m) => m._id === newIngredientId);
    if (!rm) { toast.error('Raw material not found'); return; }
    setRecipeIngredients((prev) => [
      ...prev,
      { rawMaterialId: rm._id, rawMaterialName: rm.name, unit: rm.unit, baseUnit: rm.baseUnit, quantityPerItem: qty },
    ]);
    setNewIngredientId('');
    setNewIngredientQty('');
  };

  const updateRecipeQty = (rawMaterialId: string, value: string) => {
    setRecipeIngredients((prev) =>
      prev.map((r) => (r.rawMaterialId === rawMaterialId ? { ...r, quantityPerItem: value } : r))
    );
  };

  const removeRecipeIngredient = (rawMaterialId: string) => {
    setRecipeIngredients((prev) => prev.filter((r) => r.rawMaterialId !== rawMaterialId));
  };

  // Persist the full recipe (safe replace) via PUT.
  const saveRecipe = async () => {
    if (!recipeItem || recipeSaving) return;

    // Auto-commit a pending Add-row entry: if the user selected a raw material
    // and typed a quantity but did NOT click the "+" button, still include it
    // on Save (otherwise the selection is silently dropped and an empty recipe
    // is saved). This is the common cause of "saved recipe shows no ingredients".
    let ingredientsToSave = recipeIngredients;
    if (newIngredientId) {
      const pendingQty = Number(newIngredientQty);
      if (!Number.isFinite(pendingQty) || pendingQty <= 0) {
        toast.error('Enter a quantity greater than 0 for the selected raw material (or clear the selection)');
        return;
      }
      if (recipeIngredients.some((r) => r.rawMaterialId === newIngredientId)) {
        toast.error('This raw material is already in the recipe');
        return;
      }
      const rm = rawMaterials.find((m) => m._id === newIngredientId);
      if (!rm) { toast.error('Selected raw material not found'); return; }
      ingredientsToSave = [
        ...recipeIngredients,
        { rawMaterialId: rm._id, rawMaterialName: rm.name, unit: rm.unit, baseUnit: rm.baseUnit, quantityPerItem: pendingQty },
      ];
    }

    // Validate all quantities before sending.
    for (const r of ingredientsToSave) {
      const qty = Number(r.quantityPerItem);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error(`Quantity for ${r.rawMaterialName || 'an ingredient'} must be greater than 0`);
        return;
      }
    }
    setRecipeSaving(true);
    try {
      await API.put(`/inventory/menu/${recipeItem._id}/ingredients`, {
        ingredients: ingredientsToSave.map((r) => ({
          rawMaterialId: r.rawMaterialId,
          quantityPerItem: Number(r.quantityPerItem),
        })),
      });
      toast.success('Recipe saved');
      closeRecipeModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save recipe');
    } finally {
      setRecipeSaving(false);
    }
  };

  const resetForm = () => { setFormData({ name: '', description: '', image: '', price: '', discountedPrice: '', categoryId: '', isVeg: true, isAvailable: true, isRecommended: false }); setEditingItem(null); setIsSaving(false); };

  // ── Modifiers (add-ons) ────────────────────────────────────────
  const [modifierItem,  setModifierItem]  = useState<MenuItem | null>(null);
  const [modifiers,     setModifiers]     = useState<{ name: string; price: number; isAvailable: boolean }[]>([]);
  const [modSaving,     setModSaving]     = useState(false);
  const [newModName,    setNewModName]    = useState('');
  const [newModPrice,   setNewModPrice]   = useState('');

  const openModifiers = (item: MenuItem) => {
    setModifierItem(item);
    setModifiers((item as any).modifiers?.map((m: any) => ({ name: m.name, price: m.price, isAvailable: m.isAvailable !== false })) || []);
    setNewModName(''); setNewModPrice('');
  };

  const addModifier = () => {
    if (!newModName.trim()) return;
    const p = Number(newModPrice);
    if (!Number.isFinite(p) || p < 0) { toast.error('Price must be ≥ 0'); return; }
    setModifiers(prev => [...prev, { name: newModName.trim(), price: p, isAvailable: true }]);
    setNewModName(''); setNewModPrice('');
  };

  const saveModifiers = async () => {
    if (!modifierItem) return;
    setModSaving(true);
    try {
      const res = await API.patch(`/menu/${modifierItem._id}/modifiers`, { modifiers });
      toast.success('Modifiers saved.');
      setMenuItems(prev => prev.map(m => m._id === modifierItem._id ? { ...m, ...(res.data.data || {}) } : m));
      setModifierItem(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save modifiers.');
    } finally { setModSaving(false); }
  };
  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    // categoryId may be a populated object { _id, name } — extract the raw ID
    const catId = item.categoryId
      ? (typeof item.categoryId === 'object' ? (item.categoryId as any)._id : item.categoryId)
      : '';
    setFormData({
      name:             item.name,
      description:      item.description || '',
      image:            item.image || '',
      price:            item.price.toString(),
      discountedPrice:  item.discountedPrice?.toString() || '',
      categoryId:       catId,
      isVeg:            item.isVeg,
      isAvailable:      item.isAvailable,
      isRecommended:    item.isRecommended,
    });
    setShowModal(true);
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    // The backend .populate("categoryId", "name") may put the result in either:
    // - item.categoryId (as populated object { _id, name }) — Mongoose default
    // - item.category   (the typed Category field)
    // We extract the ID from whichever is available.
    let catId = '';
    if (item.category && item.category._id) {
      catId = String(item.category._id).trim();
    } else if (item.categoryId) {
      if (typeof item.categoryId === 'object' && '_id' in (item.categoryId as any)) {
        catId = String((item.categoryId as any)._id).trim();
      } else {
        catId = String(item.categoryId).trim();
      }
    }

    const matchesCategory = !filterCategory || catId === filterCategory.trim();
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
                    <div className="flex gap-1"><button onClick={() => openRecipeModal(item)} className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500" title="Manage recipe / ingredients"><ClipboardList className="w-4 h-4" /></button><button onClick={() => openModifiers(item)} className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-500" title="Manage add-ons / modifiers"><PlusSquare className="w-4 h-4" /></button><button onClick={() => openEditModal(item)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDelete(item._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500"><Trash2 className="w-4 h-4" /></button></div>
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
                  <div><label className="label">Price (₹)</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="input" placeholder="0.00" required /></div>
                  <div><label className="label">Discounted Price (₹)</label><input type="number" step="0.01" value={formData.discountedPrice} onChange={(e) => setFormData({ ...formData, discountedPrice: e.target.value })} className="input" placeholder="Optional" /></div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="dietary" checked={formData.isVeg} onChange={() => setFormData({ ...formData, isVeg: true })} className="w-4 h-4 text-success-500" /><span className="flex items-center gap-1 text-sm"><Leaf className="w-4 h-4 text-success-500" /> Vegetarian</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="dietary" checked={!formData.isVeg} onChange={() => setFormData({ ...formData, isVeg: false })} className="w-4 h-4 text-danger-500" /><span className="flex items-center gap-1 text-sm"><Flame className="w-4 h-4 text-danger-500" /> Non-Veg</span></label>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isAvailable} onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm">Available</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.isRecommended} onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-sm flex items-center gap-1"><Star className="w-4 h-4 text-warning-500" /> Recommended</span></label>
                </div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1" disabled={isSaving}>Cancel</button><button type="submit" disabled={isSaving} className="btn btn-primary flex-1">{isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />{editingItem ? 'Updating…' : 'Creating…'}</> : editingItem ? 'Update' : 'Create'}</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inventory Step 2: Recipe / Ingredients Modal ── */}
      <AnimatePresence>
        {recipeItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={closeRecipeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-secondary-800 rounded-2xl p-6 my-8"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">Recipe · {recipeItem.name}</h2>
                <button onClick={closeRecipeModal} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-4">
                Enter the quantity of each raw material consumed for <strong>one</strong> unit of this menu item. This is
                consumption per item — not purchase price.
              </p>

              {recipeLoading ? (
                <div className="py-8 flex items-center justify-center text-secondary-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading recipe…</div>
              ) : (
                <div className="space-y-4">
                  {/* Current ingredients */}
                  <div className="space-y-2">
                    {recipeIngredients.length === 0 ? (
                      <div className="text-sm text-secondary-500 dark:text-secondary-400 text-center py-4 border border-dashed border-secondary-200 dark:border-secondary-700 rounded-lg">
                        No ingredients yet. This menu item has no recipe (that's fine).
                      </div>
                    ) : (
                      recipeIngredients.map((r) => (
                        <div key={r.rawMaterialId} className="flex items-center gap-2 border-b border-secondary-100 dark:border-secondary-700 pb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-secondary-900 dark:text-white truncate">{r.rawMaterialName || 'Raw material'}</div>
                            <div className="text-xs text-secondary-500">per 1 item · in {r.baseUnit}</div>
                          </div>
                          <input
                            type="number" step="0.001" min="0"
                            value={r.quantityPerItem}
                            onChange={(e) => updateRecipeQty(r.rawMaterialId, e.target.value)}
                            className="input w-28"
                            placeholder="Qty"
                          />
                          <span className="text-sm text-secondary-500 w-10">{r.baseUnit}</span>
                          <button onClick={() => removeRecipeIngredient(r.rawMaterialId)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add new ingredient */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label">Raw material</label>
                      <select value={newIngredientId} onChange={(e) => setNewIngredientId(e.target.value)} className="input">
                        <option value="">Select…</option>
                        {rawMaterials
                          .filter((m) => !recipeIngredients.some((r) => r.rawMaterialId === m._id))
                          .map((m) => (
                            <option key={m._id} value={m._id}>{m.name} ({m.baseUnit})</option>
                          ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="label">Qty / item</label>
                      <input type="number" step="0.001" min="0" value={newIngredientQty} onChange={(e) => setNewIngredientQty(e.target.value)} className="input" placeholder="0" />
                    </div>
                    <button type="button" onClick={addRecipeIngredient} className="btn btn-secondary"><Plus className="w-4 h-4" /></button>
                  </div>
                  {rawMaterials.length === 0 && (
                    <p className="text-xs text-warning-600">No raw materials found. Add raw materials in Inventory first.</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeRecipeModal} className="btn btn-secondary flex-1" disabled={recipeSaving}>Cancel</button>
                    <button type="button" onClick={saveRecipe} disabled={recipeSaving} className="btn btn-primary flex-1">
                      {recipeSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Recipe'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modifiers (Add-ons) Modal ─────────────────────────────── */}
      <AnimatePresence>
        {modifierItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setModifierItem(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-secondary-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-secondary-900 dark:text-white">Add-ons · {modifierItem.name}</h2>
                  <p className="text-xs text-secondary-400 mt-0.5">e.g. Extra cheese +₹20, No onion ₹0</p>
                </div>
                <button onClick={() => setModifierItem(null)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Existing modifiers */}
              {modifiers.length === 0 ? (
                <p className="text-sm text-secondary-400 py-4 text-center">No add-ons yet. Add one below.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {modifiers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-700/50">
                      <input value={m.name} onChange={e => setModifiers(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 bg-transparent text-sm text-secondary-900 dark:text-white outline-none" />
                      <span className="text-secondary-400 text-xs">₹</span>
                      <input type="number" min={0} value={m.price}
                        onChange={e => setModifiers(prev => prev.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))}
                        className="w-20 bg-transparent text-sm text-secondary-900 dark:text-white outline-none text-right" />
                      <button type="button" onClick={() => setModifiers(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-danger-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new modifier */}
              <div className="flex gap-2 mb-5">
                <input value={newModName} onChange={e => setNewModName(e.target.value)}
                  placeholder="Add-on name" className="input flex-1 py-2 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addModifier(); }}} />
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary-400 text-sm">₹</span>
                  <input type="number" min={0} value={newModPrice} onChange={e => setNewModPrice(e.target.value)}
                    placeholder="0" className="input w-full pl-6 py-2 text-sm" />
                </div>
                <button type="button" onClick={addModifier} className="btn btn-secondary py-2 px-3">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModifierItem(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={saveModifiers} disabled={modSaving} className="btn btn-primary flex-1 disabled:opacity-60">
                  {modSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Add-ons'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BUG Z FIX: Delete Menu Item Confirm Modal ── */}
      <AnimatePresence>
        {deleteMenuTargetId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteMenuTargetId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-secondary-800 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-danger-600" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary-900 dark:text-white">Delete Menu Item</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteMenuTargetId(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={confirmDeleteMenu} className="btn btn-danger flex-1">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
