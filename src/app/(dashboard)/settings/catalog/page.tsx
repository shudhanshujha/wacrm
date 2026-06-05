import { Suspense } from 'react';
import { CatalogManager } from '@/components/settings/catalog-manager';

export const dynamic = 'force-dynamic';

export default function CatalogSettingsPage() {
  return (
    <Suspense>
      <CatalogManager />
    </Suspense>
  );
}
