import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, FolderTree,
  X, Image, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import type { Category } from '../types';

export function CategoriesPage() {
  const [categories, setCategories]       = useState<Category[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [reordering, setReordering]       = useState<string | null>(null); // id being saved

  const [formData, setFormData] = useState({
    name: '', description: '', image: '', isActive: true,
  });

  // ── Drag state refs (no re-render needed while dragging) ──────
  const dragId    = useRef<string | null>(null); // id being dragged
  const dragOver  = useRef<string | null>(null); // id currently hovered

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await API.get('/categories');
      // Always display sorted by displayOrder
      const sorted = (res.data.data || []).sort(
        (a: Category, b: Category) => a.displayOrder - b.displayOrder
      );
      setCategories(sorted);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Drag handlers ─────────────────────────────────────────────
  const onDragStart = (id: string) => {
    dragId.current = id;
  };

  const onDragEnter = (id: string) => {
    dragOver.current = id;
  };

  const onDragEnd = async () => {
    const fromId = dragId.current;
    const toId   = dragOver.current;
    dragId.current   = null;
    dragOver.current = null;

    if (!fromId || !toId || fromId === toId) return;

    const fromIdx = categories.findIndex(c => c._id === fromId);
    const toIdx   = categories.findIndex(c => c._id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Reorder the array
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Assign new 1-based displayOrder to every item
    const updated = reordered.map((c, i) => ({ ...c, displayOrder: i + 1 }));

    // Optimistic UI update immediately
    setCategories(updated);

    // Build a lookup of old orders by id for comparison
    const oldOrderById: Record<string, number> = {};
    categories.forEach(c => { oldOrderById[c._id] = c.displayOrder; });

    // Only send items whose displayOrder actually changed
    const orders = updated
      .filter(c => c.displayOrder !== oldOrderById[c._id])
      .map(c => ({ id: c._id, displayOrder: c.displayOrder }));

    if (orders.length === 0) return;

    setReordering(fromId);
    try {
      await API.patch('/categories/reorder', { orders });
      toast.success('Order saved');
    } catch {
      toast.error('Failed to save order — changes reverted');
      fetchCategories(); // rollback to server state
    } finally {
      setReordering(null);
    }
  };

  // ── CRUD handlers ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await API.put(`/categories/${editingCategory._id}`, formData);
        toast.success('Category updated');
      } else {
        await API.post('/categories', { ...formData, restaurantId: 'FLOWUP001' });
        toast.success('Category created');
      }
      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await API.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const handleToggleStatus = async (category: Category) => {
    try {
      await API.patch(`/categories/${category._id}/toggle-status`);
      toast.success('Status updated');
      fetchCategories();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', image: '', isActive: true });
    setEditingCategory(null);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      isActive: category.isActive,
    });
    setShowModal(true);
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // ── Loading skeleton ──────────────────────────────────────────
  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="skeleton h-10 w-full max-w-md" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="skeleton h-6 w-6 rounded" />
            <div className="skeleton h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Categories</h1>
          <p className="text-secondary-500 dark:text-secondary-400 text-sm">
            Drag rows to reorder · {categories.length} categories
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn btn-primary">
          <Plus className="w-5 h-5" /> Add Category
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
        <input
          type="text" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search categories…" className="input pl-12"
        />
      </div>

      {/* ── Drag-and-drop list ── */}
      {filteredCategories.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderTree className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600 mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">No categories found</h3>
          <p className="text-secondary-500 dark:text-secondary-400 mb-4">
            {searchQuery ? 'Try a different search term' : 'Create your first category to get started'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus className="w-5 h-5" /> Add Category
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2 bg-secondary-50 dark:bg-secondary-700/50
                          border-b border-secondary-200 dark:border-secondary-700 text-xs font-semibold
                          text-secondary-500 uppercase tracking-wide">
            <span className="w-6" />
            <span className="w-12">Order</span>
            <span className="w-12">Image</span>
            <span className="flex-1">Name</span>
            <span className="hidden sm:block w-24 text-center">Status</span>
            <span className="w-24 text-right">Actions</span>
          </div>

          <AnimatePresence>
            {filteredCategories.map((category) => {
              const isSaving = reordering === category._id;

              return (
                <motion.div
                  key={category._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  // ── HTML5 drag-and-drop ──
                  draggable
                  onDragStart={() => onDragStart(category._id)}
                  onDragEnter={() => onDragEnter(category._id)}
                  onDragEnd={onDragEnd}
                  onDragOver={e => e.preventDefault()} // required to allow drop
                  className={`flex items-center gap-4 px-4 py-3 border-b border-secondary-100
                              dark:border-secondary-700 last:border-0 transition-colors
                              hover:bg-secondary-50 dark:hover:bg-secondary-700/40
                              ${!category.isActive ? 'opacity-50' : ''}
                              ${isSaving ? 'opacity-60' : ''}`}
                >
                  {/* Drag handle */}
                  <div className="w-6 flex items-center justify-center cursor-grab active:cursor-grabbing
                                  text-secondary-300 hover:text-secondary-500 transition-colors shrink-0">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Display order badge */}
                  <div className="w-12 shrink-0">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg
                                     bg-secondary-100 dark:bg-secondary-700
                                     text-xs font-bold text-secondary-600 dark:text-secondary-300">
                      {category.displayOrder}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary-100 dark:bg-secondary-700
                                  flex items-center justify-center shrink-0">
                    {category.image
                      ? <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                      : <Image className="w-6 h-6 text-secondary-300 dark:text-secondary-600" />
                    }
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary-900 dark:text-white truncate">
                      {category.name}
                      {isSaving && (
                        <span className="ml-2 text-xs text-primary-500 font-normal animate-pulse">
                          saving…
                        </span>
                      )}
                    </p>
                    {category.description && (
                      <p className="text-xs text-secondary-400 dark:text-secondary-500 truncate mt-0.5">
                        {category.description}
                      </p>
                    )}
                  </div>

                  {/* Active toggle */}
                  <div className="hidden sm:flex w-24 justify-center shrink-0">
                    <button
                      onClick={() => handleToggleStatus(category)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                                  transition-colors ${
                        category.isActive
                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300 hover:bg-success-200'
                          : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-700 hover:bg-secondary-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        category.isActive ? 'bg-success-500' : 'bg-secondary-400'
                      }`} />
                      {category.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Edit / Delete */}
                  <div className="w-24 flex items-center justify-end gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(category)}
                      className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700
                                 text-secondary-500 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category._id)}
                      className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20
                                 text-danger-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-secondary-800 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input" placeholder="e.g., Appetizers" required
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="input min-h-[80px]" placeholder="Describe this category…"
                  />
                </div>
                <div>
                  <label className="label">Image URL</label>
                  <input
                    type="url" value={formData.image}
                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                    className="input" placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" id="isActive" checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-secondary-300"
                  />
                  <label htmlFor="isActive" className="text-sm text-secondary-700 dark:text-secondary-300">
                    Active
                  </label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
