"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect, useMemo } from "react";
import { Send, LayoutTemplate, Sparkles, Loader2, BookOpen, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import { Message, CannedReply } from "@/types";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { ProductPickerModal } from "./product-picker-modal";

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
  messages: Message[];
  contactName: string;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
  messages,
  contactName,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [cannedSearch, setCannedSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadCanned() {
      const supabase = createClient();
      const { data } = await supabase
        .from("canned_replies")
        .select("*")
        .order("title");
      if (data) setCannedReplies(data as CannedReply[]);
    }
    loadCanned();
  }, []);

  const filteredCanned = useMemo(() => {
    return cannedReplies.filter(
      (r) =>
        r.title.toLowerCase().includes(cannedSearch.toLowerCase()) ||
        (r.shortcut ?? "").toLowerCase().includes(cannedSearch.toLowerCase()) ||
        r.content.toLowerCase().includes(cannedSearch.toLowerCase())
    );
  }, [cannedReplies, cannedSearch]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const insertCanned = useCallback((content: string) => {
    setText(content);
    setShowCannedPicker(false);
    setCannedSearch("");
    // Trigger height adjust on next tick
    setTimeout(adjustHeight, 0);
  }, [adjustHeight]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-10).map((m) => ({
            role: m.sender_type === "customer" ? "inbound" : "outbound",
            content: m.content_text ?? "",
            created_at: m.created_at,
          })),
          contactName,
        }),
      });

      if (!response.ok) throw new Error("AI service unavailable");

      const data = await response.json();
      setAiSuggestion(data.suggestion);
    } catch (err) {
      toast.error("Could not generate suggestion");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showCannedPicker && filteredCanned.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCanned.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCanned.length) % filteredCanned.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertCanned(filteredCanned[selectedIndex].content);
          return;
        }
        if (e.key === "Escape") {
          setShowCannedPicker(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, showCannedPicker, filteredCanned, selectedIndex, insertCanned]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      adjustHeight();

      // Simple autocomplete check
      if (val.startsWith("/") && val.length > 1) {
        setCannedSearch(val.slice(1));
        setShowCannedPicker(true);
        setSelectedIndex(0);
      } else if (val === "/") {
        setCannedSearch("");
        setShowCannedPicker(true);
        setSelectedIndex(0);
      } else {
        setShowCannedPicker(false);
      }
    },
    [adjustHeight]
  );

  return (
    <div className="relative border-t border-border bg-background p-3">
      {/* Canned Reply Picker */}
      {showCannedPicker && (
        <div className="absolute bottom-full left-0 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-2xl z-50">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search quick replies..."
              value={cannedSearch}
              onChange={(e) => {
                setCannedSearch(e.target.value);
                setSelectedIndex(0);
              }}
              className="h-8 bg-muted border-input text-sm focus-visible:ring-primary/50"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCanned.map((reply, idx) => (
              <button
                key={reply.id}
                className={cn(
                  "w-full px-3 py-2 text-left transition-colors",
                  selectedIndex === idx ? "bg-primary/10" : "hover:bg-accent"
                )}
                onClick={() => insertCanned(reply.content)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm font-medium",
                    selectedIndex === idx ? "text-primary" : "text-foreground"
                  )}>
                    {reply.title}
                  </span>
                  {reply.shortcut && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                      {reply.shortcut}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{reply.content}</p>
              </button>
            ))}
            {filteredCanned.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No quick replies found
              </p>
            )}
          </div>
        </div>
      )}

      {aiSuggestion && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 space-y-2">
            <p className="text-foreground leading-relaxed">{aiSuggestion}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs font-medium text-primary hover:bg-primary/10"
                onClick={() => {
                  setText(aiSuggestion);
                  setAiSuggestion(null);
                  // Trigger height adjust on next tick
                  setTimeout(adjustHeight, 0);
                }}
              >
                Use Suggestion
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setAiSuggestion(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}
      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            onClick={onOpenTemplates}
            title="Send template"
          >
            <LayoutTemplate className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setProductModalOpen(true)}
            title="Send product catalog"
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-9 p-0 transition-colors",
              showCannedPicker ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowCannedPicker((p) => !p)}
            title="Quick replies (/)"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            sessionExpired
              ? "Session expired - use a template"
              : "Type a message... (Shift+Enter for new line)"
          }
          disabled={sessionExpired}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-input bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50",
            sessionExpired && "cursor-not-allowed opacity-50"
          )}
        />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiSuggest}
            disabled={aiLoading || sessionExpired}
            className="h-9 border-input bg-muted text-muted-foreground hover:bg-accent px-3 transition-all"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            <span className="ml-2 hidden lg:inline text-xs font-medium">AI Suggest</span>
          </Button>

          <Button
            size="sm"
            className="h-9 w-9 shrink-0 bg-primary p-0 hover:bg-primary/90 disabled:opacity-40"
            disabled={!text.trim() || sessionExpired || sending}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-1 pl-11 text-[10px] text-muted-foreground/50">
        Type &apos;/&apos; for quick replies
      </p>

      {/* Product Picker Modal */}
      <ProductPickerModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        conversationId={conversationId}
        onSent={() => setProductModalOpen(false)}
      />
    </div>
  );
}

