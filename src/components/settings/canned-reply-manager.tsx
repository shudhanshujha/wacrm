'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CannedReply } from '@/types';
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
import { Plus, Pencil, Trash2, Loader2, MessageSquareQuote } from 'lucide-react';
import { toast } from 'sonner';

export function CannedReplyManager() {
  const supabase = createClient();
  const [replies, setReplies] = useState<CannedReply[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<CannedReply | null>(null);
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CannedReply | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('canned_replies')
      .select('*')
      .order('title');

    if (error) {
      toast.error('Failed to load canned replies');
    } else {
      setReplies(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReplies();
  }, [fetchReplies]);

  function openAdd() {
    setEditingReply(null);
    setTitle('');
    setShortcut('');
    setContent('');
    setDialogOpen(true);
  }

  function openEdit(reply: CannedReply) {
    setEditingReply(reply);
    setTitle(reply.title);
    setShortcut(reply.shortcut ?? '');
    setContent(reply.content);
    setDialogOpen(true);
  }

  function confirmDelete(reply: CannedReply) {
    setDeleteTarget(reply);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('canned_replies')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete reply');
    } else {
      toast.success('Reply deleted');
      fetchReplies();
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
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

    // Ensure shortcut starts with /
    let cleanShortcut = shortcut.trim();
    if (cleanShortcut && !cleanShortcut.startsWith('/')) {
      cleanShortcut = `/${cleanShortcut}`;
    }

    const payload = {
      user_id: user.id,
      title: title.trim(),
      shortcut: cleanShortcut || null,
      content: content.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingReply) {
      const { error: err } = await supabase
        .from('canned_replies')
        .update(payload)
        .eq('id', editingReply.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('canned_replies').insert(payload);
      error = err;
    }

    if (error) {
      toast.error('Failed to save canned reply');
    } else {
      toast.success(editingReply ? 'Reply updated' : 'Reply created');
      setDialogOpen(false);
      fetchReplies();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Canned Replies</h2>
          <p className="text-sm text-slate-400">
            Save frequently used messages for quick access in the inbox.
          </p>
        </div>
        <Button onClick={openAdd} className="bg-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          New Reply
        </Button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Title</TableHead>
              <TableHead className="text-slate-400">Shortcut</TableHead>
              <TableHead className="text-slate-400">Content</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : replies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquareQuote className="h-8 w-8 opacity-20" />
                    <p>No canned replies yet. Create your first one!</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              replies.map((reply) => (
                <TableRow key={reply.id} className="border-slate-800">
                  <TableCell className="font-medium text-white">
                    {reply.title}
                  </TableCell>
                  <TableCell>
                    {reply.shortcut ? (
                      <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-primary">
                        {reply.shortcut}
                      </code>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-slate-400">
                    {reply.content}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(reply)}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmDelete(reply)}
                        className="h-8 w-8 text-slate-400 hover:text-red-400"
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
        <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Edit Canned Reply' : 'New Canned Reply'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Welcome Message"
                className="border-slate-700 bg-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortcut">
                Shortcut <span className="text-xs text-slate-500">(optional)</span>
              </Label>
              <Input
                id="shortcut"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="/hello"
                className="border-slate-700 bg-slate-800"
              />
              <p className="text-[10px] text-slate-500">
                Type this in the inbox to quickly insert the reply.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="The message to send..."
                rows={4}
                className="border-slate-700 bg-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open: boolean) => !open && setDeleteConfirmOpen(false)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Canned Reply</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete <span className="text-white font-medium">{deleteTarget?.title}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300"
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
