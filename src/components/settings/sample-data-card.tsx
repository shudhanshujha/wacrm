'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Database, Loader2, Play } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SampleDataCard() {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!confirm('This will add sample contacts, companies, deals, and messages to your account. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to seed data');
      }

      toast.success('Sample data seeded successfully!', {
        description: 'Refresh the page to see the changes across all modules.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error during seeding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Database className="size-5 text-primary" />
          Sample Data
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Populate your workspace with placeholder contacts, companies, deals, and conversations to test the platform&apos;s features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Generate Demo Workspace</p>
            <p className="text-xs text-muted-foreground">
              Inserts ~10 records across all core modules for immediate demonstration.
            </p>
          </div>
          <Button 
            onClick={handleSeed} 
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            Seed Sample Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
