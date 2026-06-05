'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  onSaved: () => void;
}

export function CompanyModal({ open, onOpenChange, company, onSaved }: CompanyModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setName(company?.name ?? '');
        setDomain(company?.domain ?? '');
        setIndustry(company?.industry ?? '');
        setWebsite(company?.website ?? '');
        setPhone(company?.phone ?? '');
        setAddress(company?.address ?? '');
        setNotes(company?.notes ?? '');
      }, 0);
    }
  }, [open, company]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Company name is required');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error('Not authenticated');
      setSaving(false);
      return;
    }

    const payload = {
      name: name.trim(),
      domain: domain.trim() || null,
      industry: industry.trim() || null,
      website: website.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (company) {
      const { error: err } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', company.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('companies')
        .insert({ ...payload, user_id: user.id });
      error = err;
    }

    if (error) {
      toast.error(`Failed to save company: ${error.message}`);
    } else {
      toast.success(company ? 'Company updated' : 'Company created');
      onOpenChange(false);
      onSaved();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{company ? 'Edit Company' : 'Add Company'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {company
              ? 'Update the organization details.'
              : 'Add a new organization to group your contacts.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="company-name" className="text-slate-300">Name *</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              className="border-slate-700 bg-slate-800 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-domain" className="text-slate-300">Domain</Label>
              <Input
                id="company-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-industry" className="text-slate-300">Industry</Label>
              <Input
                id="company-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Technology"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-website" className="text-slate-300">Website</Label>
              <Input
                id="company-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone" className="text-slate-300">Phone</Label>
              <Input
                id="company-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1..."
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-address" className="text-slate-300">Address</Label>
            <Input
              id="company-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St..."
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-notes" className="text-slate-300">Notes</Label>
            <Textarea
              id="company-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this organization..."
              className="border-slate-700 bg-slate-800 text-white min-h-20"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {company ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
