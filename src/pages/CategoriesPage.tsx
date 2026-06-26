import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, FolderTree, X, Image, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import API from "../lib/api";
import type { Category } from '../types';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
  name: "",
  description: "",
  image: "",
  displayOrder: 0,
  isActive: true,
});

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
  try {
    setIsLoading(true);

    const response =
      await API.get("/categories");

    setCategories(
      response.data.data || []
    );
  } catch (error) {
    console.error(error);
    toast.error(
      "Failed to load categories"
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
    if (editingCategory) {
      await API.put(
        `/categories/${editingCategory._id}`,
        formData
      );

      toast.success(
        "Category updated successfully"
      );
    } else {
      await API.post(
        "/categories",
        {
          ...formData,
          restaurantId:
            "FLOWUP001",
        }
      );

      toast.success(
        "Category created successfully"
      );
    }

    setShowModal(false);

    resetForm();

    fetchCategories();
  } catch (error) {
    console.error(error);

    toast.error(
      "Failed to save category"
    );
  }
};

  const handleDelete = async (
  id: string
) => {
  if (
    !confirm(
      "Are you sure?"
    )
  )
    return;

  try {
    await API.delete(
      `/categories/${id}`
    );

    toast.success(
      "Category deleted"
    );

    fetchCategories();
  } catch (error) {
    toast.error(
      "Failed to delete category"
    );
  }
};

  const handleToggleStatus =
  async (
    category: Category
  ) => {
    try {
      await API.patch(
        `/categories/${category._id}/toggle-status`
      );

      toast.success(
        "Status updated"
      );

      fetchCategories();
    } catch (error) {
      toast.error(
        "Failed to update status"
      );
    }
  };

  const handleMoveOrder = async (
  category: Category,
  direction: "up" | "down"
) => {
  toast(
    "Category reordering is not implemented yet"
  );
};

  const resetForm = () => { setFormData({ name: '', description: '', image: '', displayOrder: categories.length + 1, isActive: true }); setEditingCategory(null); };
  const openEditModal = (category: Category) => { setEditingCategory(category); setFormData({ name: category.name, description: category.description || '', image: category.image || '', displayOrder: category.displayOrder, isActive: category.isActive }); setShowModal(true); };
  const filteredCategories = categories.filter((category) => category.name.toLowerCase().includes(searchQuery.toLowerCase()) || (category.description?.toLowerCase() || '').includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="skeleton h-10 w-full max-w-md" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="card p-4"><div className="skeleton h-32 w-full mb-4" /><div className="skeleton h-4 w-24 mb-2" /><div className="skeleton h-3 w-full" /></div>)}</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Categories</h1><p className="text-secondary-500 dark:text-secondary-400">Manage your menu categories</p></div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary"><Plus className="w-5 h-5" />Add Category</button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search categories..." className="input pl-12" />
      </div>

      {filteredCategories.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderTree className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600 mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">No categories found</h3>
          <p className="text-secondary-500 dark:text-secondary-400 mb-4">{searchQuery ? 'Try a different search term' : 'Create your first category'}</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus className="w-5 h-5" />Add Category</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredCategories.map((category, index) => (
              <motion.div key={category._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: index * 0.05 }} className={`card overflow-hidden ${!category.isActive ? 'opacity-60' : ''}`}>
                <div className="relative h-32 bg-secondary-100 dark:bg-secondary-700">
                  {category.image ? <img src={category.image} alt={category.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image className="w-12 h-12 text-secondary-300 dark:text-secondary-600" /></div>}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="badge bg-secondary-800/80 text-white">#{category.displayOrder}</span>
                    <span className={`badge ${category.isActive ? 'bg-success-500/80 text-white' : 'bg-secondary-500/80 text-white'}`}>{category.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-secondary-900 dark:text-white mb-1">{category.name}</h3>
                  {category.description && <p className="text-sm text-secondary-500 dark:text-secondary-400 line-clamp-2 mb-4">{category.description}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <button onClick={() => handleMoveOrder(category, 'up')} disabled={index === 0} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => handleMoveOrder(category, 'down')} disabled={index === filteredCategories.length - 1} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleStatus(category)} className={`p-2 rounded-lg transition-colors ${category.isActive ? 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20' : 'text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700'}`} title={category.isActive ? 'Deactivate' : 'Activate'}><div className={`w-5 h-5 rounded-full border-2 ${category.isActive ? 'border-success-500 bg-success-500' : 'border-secondary-300'}`} /></button>
                      <button onClick={() => openEditModal(category)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(category._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 text-danger-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white dark:bg-secondary-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="label">Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="e.g., Appetizers" required /></div>
                <div><label className="label">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input min-h-[100px]" placeholder="Describe this category..." /></div>
                <div><label className="label">Image URL</label><input type="url" value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="input" placeholder="https://example.com/image.jpg" /></div>
                <div><label className="label">Display Order</label><input type="number" value={formData.displayOrder} onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })} className="input" min={1} /></div>
                <div className="flex items-center gap-2"><input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 rounded border-secondary-300" /><label htmlFor="isActive" className="text-sm text-secondary-700 dark:text-secondary-300">Active</label></div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">Cancel</button><button type="submit" className="btn btn-primary flex-1">{editingCategory ? 'Update' : 'Create'}</button></div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
