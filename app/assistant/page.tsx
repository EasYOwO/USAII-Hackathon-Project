'use client';

import { ElderlyAssistantClient } from '@/elderly-assistant/ElderlyAssistantClient';

export default function AssistantPage() {
  return (
    <main className="shell assistant-shell chat-only-shell">
      <ElderlyAssistantClient />
    </main>
  );
}
