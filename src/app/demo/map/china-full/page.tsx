'use client';

import { SplitPane } from '@/components/ui/split-pane';
import { ChinaMapLibrePanel } from './ChinaMapLibrePanel';
import { ChinaOpenLayersPanel } from './ChinaOpenLayersPanel';

export default function ChinaFullPage() {
  return (
    <div className="h-screen w-full">
      <SplitPane
        initialLeftRatio={0.5}
        minLeftPx={360}
        minRightPx={360}
        left={<ChinaMapLibrePanel />}
        right={<ChinaOpenLayersPanel />}
      />
    </div>
  );
}
