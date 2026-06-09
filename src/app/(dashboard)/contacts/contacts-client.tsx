'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Ban,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
  company_data?: { id: string; name: string } | null;
}

interface ContactsClientProps {
  initialContacts: ContactWithTags[];
  initialCount: number;
  initialTags: Record<string, Tag>;
  initialCompanies: Company[];
}

export function ContactsClient({
  initialContacts,
  initialCount,
  initialTags,
  initialCompanies,
}: ContactsClientProps) {
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactWithTags[]>(initialContacts);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [showOptedOut, setShowOptedOut] = useState(false);
  const [companies] = useState<Company[]>(initialCompanies);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>(initialTags);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
    }
  }, [supabase]);



  const fetchContacts = useCallback(async () => {
    setLoading(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('contacts')
      .select('*, company_data:companies(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!showOptedOut) {
      query = query.eq('whatsapp_opted_out', false);
    }

    if (companyFilter !== 'all') {
      query = query.eq('company_id', companyFilter);
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    let { data, count, error } = await query;

    if (error) {
      let fallbackQuery = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        fallbackQuery = fallbackQuery.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
      }

      const fallbackResult = await fallbackQuery;
      if (!fallbackResult.error && fallbackResult.data) {
        data = fallbackResult.data as unknown as ContactWithTags[];
        count = fallbackResult.count;
        error = null;
      }
    }

    if (error) {
      toast.error(`Failed to load contacts: ${error.message}`);
      setLoading(false);
      return;
    }

    setTotalCount(count ?? 0);

    if (!data || data.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = data.map((c) => c.id);
    let contactTagsData: { contact_id: string; tag_id: string }[] = [];
    
    try {
      const { data: contactTags, error: tagsError } = await supabase
        .from('contact_tags')
        .select('contact_id, tag_id')
        .in('contact_id', contactIds);
      if (!tagsError && contactTags) {
        contactTagsData = contactTags;
      }
    } catch {}

    const tagsByContact: Record<string, string[]> = {};
    contactTagsData.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const enriched: ContactWithTags[] = data.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, tagsMap, showOptedOut, companyFilter]);

  // We skip the initial mount fetch because the server already provided it.
  // Subsequent changes to page/search/filter will trigger the effect.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchContacts();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchContacts, page, search, showOptedOut, companyFilter]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete contact');
    } else {
      toast.success('Contact deleted');
      fetchContacts();
    }

    setDeleting(true); // wait for toast
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleting(false);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your contact list. {totalCount > 0 && `${totalCount} total contacts.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-accent"
          >
            <Upload className="size-4" />
            Import
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowOptedOut(!showOptedOut);
              setPage(0);
            }}
            className={`border-border ${
              showOptedOut ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
            }`}
          >
            <Ban className="size-4" />
            {showOptedOut ? 'Showing All' : 'Hide Opted-out'}
          </Button>
          <Button
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative max-w-sm flex-1 w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, phone, or email..."
            className="pl-8 bg-muted border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        
        <Select 
          value={companyFilter} 
          onValueChange={(val) => {
            if (val) {
              setCompanyFilter(val);
              setPage(0);
            }
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px] border-border bg-muted text-foreground">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent className="border-border bg-card text-foreground">
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card/30">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Contact</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Info</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Status</TableHead>
              <TableHead className="text-muted-foreground hidden sm:table-cell">Tags</TableHead>
              <TableHead className="text-muted-foreground hidden lg:table-cell tabular-nums">Created</TableHead>
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading contacts...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No contacts match your search.' : 'No contacts yet.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="border-border hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell>
                    <div className="flex flex-col min-w-0">
                      <span className="text-foreground font-semibold truncate">
                        {contact.name || <span className="text-muted-foreground italic">Unnamed</span>}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {contact.phone}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col min-w-0 text-xs gap-0.5">
                      {contact.email && (
                        <span className="text-muted-foreground truncate">{contact.email}</span>
                      )}
                      {contact.company_data ? (
                        <Link 
                          href={`/companies/${contact.company_data.id}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline truncate"
                        >
                          {contact.company_data.name}
                        </Link>
                      ) : contact.company && (
                        <span className="text-muted-foreground/60 truncate">{contact.company} (legacy)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {contact.whatsapp_opted_out ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-400/80">
                        <Ban className="size-3" />
                        Opted out
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-green-400/80">
                        Opted in
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight"
                            style={{
                              backgroundColor: tag.color + '15',
                              color: tag.color,
                              border: `1px solid ${tag.color}30`
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground/20">—</span>
                      )}
                      {contact.tags && contact.tags.length > 2 && (
                        <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px] hidden lg:table-cell tabular-nums">
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent
                        align="end"
                        className="bg-card border-border text-foreground"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(contact);
                          }}
                          className="text-muted-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(contact);
                          }}
                          className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{' '}
            {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals ... (keeping original modal logic) */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
      />
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Contact</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete{' '}
              <span className="text-foreground font-medium">
                {deleteTarget?.name || deleteTarget?.phone}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-card border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
