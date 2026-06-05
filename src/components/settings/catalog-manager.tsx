'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, ShoppingBag, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
// TODO: add image domain to next.config.js if needed
// import Image from 'next/image';

export interface CatalogProduct {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  retailer_id: string;
  is_active: boolean;
  created_at: string;
}

export function CatalogManager() {
  const supabase = createClient();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [imageUrl, setImageUrl] = useState('');
  const [retailerId, setRetailerId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('catalog_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load products');
    } else {
      setProducts(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setTimeout(() => {
      fetchProducts();
    }, 0);
  }, [fetchProducts]);

  function openAdd() {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPrice('0');
    setCurrency('INR');
    setImageUrl('');
    setRetailerId('');
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(product: CatalogProduct) {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description ?? '');
    setPrice(product.price.toString());
    setCurrency(product.currency);
    setImageUrl(product.image_url ?? '');
    setRetailerId(product.retailer_id);
    setIsActive(product.is_active);
    setDialogOpen(true);
  }

  function confirmDelete(product: CatalogProduct) {
    setDeleteTarget(product);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('catalog_products')
      .update({ is_active: false })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete product');
    } else {
      toast.success('Product removed');
      fetchProducts();
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !retailerId.trim() || isNaN(Number(price))) {
      toast.error('Name, valid Price, and Retailer ID are required');
      return;
    }

    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      toast.error('Not authenticated');
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      price: Number(price),
      currency,
      image_url: imageUrl.trim() || null,
      retailer_id: retailerId.trim(),
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingProduct) {
      const { error: err } = await supabase
        .from('catalog_products')
        .update(payload)
        .eq('id', editingProduct.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('catalog_products').insert(payload);
      error = err;
    }

    if (error) {
      toast.error(`Failed to save product: ${error.message}`);
    } else {
      toast.success(editingProduct ? 'Product updated' : 'Product created');
      setDialogOpen(false);
      fetchProducts();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">WhatsApp Catalog</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your products to send interactive catalog messages.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-800/50 bg-amber-900/20 p-4 text-sm text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>
            WhatsApp Catalog messages require a Meta Commerce Manager catalog linked to your WhatsApp Business Account.
          </p>
          <p>
            The <strong>Retailer ID</strong> you enter here must exactly match the Retailer ID / Content ID of the product in your Meta catalog.
          </p>
          <a
            href="https://business.facebook.com/commerce"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-amber-200 hover:underline"
          >
            Meta Commerce Manager <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} className="bg-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-16"></TableHead>
              <TableHead className="text-muted-foreground">Name</TableHead>
              <TableHead className="text-muted-foreground">Price</TableHead>
              <TableHead className="text-muted-foreground">Retailer ID</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShoppingBag className="h-8 w-8 opacity-20" />
                    <p>No products yet. Add your first product!</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id} className="border-border">
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-muted ring-1 ring-border">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{product.name}</div>
                    {product.description && (
                      <div className="truncate text-xs text-muted-foreground max-w-[200px]">
                        {product.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: product.currency,
                    }).format(product.price)}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {product.retailer_id}
                    </code>
                  </TableCell>
                  <TableCell>
                    {product.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(product)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmDelete(product)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Details for your WhatsApp catalog item.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product Name"
                className="border-input bg-muted text-foreground"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="border-input bg-muted text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(val) => val && setCurrency(val)}>
                  <SelectTrigger className="border-input bg-muted text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                    <SelectItem value="SGD">SGD (S$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retailerId">
                Retailer ID <span className="text-red-400">*</span>
              </Label>
              <Input
                id="retailerId"
                value={retailerId}
                onChange={(e) => setRetailerId(e.target.value)}
                placeholder="SKU-12345"
                className="border-input bg-muted font-mono text-xs text-foreground"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Must exactly match the Content ID in Meta Commerce Manager.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description..."
                rows={3}
                className="border-input bg-muted text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="border-input bg-muted text-foreground"
              />
              {imageUrl && (
                <div className="mt-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-input bg-muted">
                  <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-input bg-muted p-3">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">Available to send in messages</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-input text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Product</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to remove <span className="font-medium text-foreground">{deleteTarget?.name}</span>? 
              This will mark it as inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-input text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
