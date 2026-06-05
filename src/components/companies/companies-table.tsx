'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Building2, Pencil, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { CompanyModal } from './company-modal';

// Extend Company type to include the joined count from Supabase
export interface CompanyWithCount extends Company {
  contacts: [{ count: number }];
}

export function CompaniesTable({ initialCompanies }: { initialCompanies: CompanyWithCount[] }) {
  const [companies, setCompanies] = useState<CompanyWithCount[]>(initialCompanies);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchCompanies() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('companies')
      .select('*, contacts(count)')
      .order('name');
    
    if (error) {
      toast.error('Failed to refresh companies');
    } else {
      setCompanies((data as unknown as CompanyWithCount[]) ?? []);
    }
    setLoading(false);
  }

  function openAdd() {
    setEditingCompany(null);
    setModalOpen(true);
  }

  function openEdit(company: Company) {
    setEditingCompany(company);
    setModalOpen(true);
  }

  function confirmDelete(company: Company) {
    setDeleteTarget(company);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete company');
    } else {
      toast.success('Company deleted');
      fetchCompanies();
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400 hidden sm:table-cell">Domain</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Industry</TableHead>
              <TableHead className="text-slate-400">Contacts</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 opacity-20" />
                    <p>No companies yet. Add your first company to group contacts.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => {
                const count = company.contacts?.[0]?.count ?? 0;
                return (
                  <TableRow key={company.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <TableCell>
                      <Link href={`/companies/${company.id}`} className="font-medium text-white hover:text-primary transition-colors inline-flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-400 hidden sm:table-cell">
                      {company.domain ? (
                        <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {company.domain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-slate-400 hidden md:table-cell">
                      {company.industry || '-'}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
                        {count}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(company)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(company)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        company={editingCompany}
        onSaved={fetchCompanies}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open: boolean) => !open && setDeleteConfirmOpen(false)}
      >
        <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the company <strong className="text-white">{deleteTarget?.name}</strong>. 
              Any contacts associated with this company will remain, but will no longer be linked to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
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
              Delete Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
