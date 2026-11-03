import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Modal } from '../ui/Modal';

interface StudentRegistrationResponsesModalProps {
  eventId: string;
  registrationId: string | null;
  onClose: () => void;
}

export function StudentRegistrationResponsesModal({ eventId, registrationId, onClose }: StudentRegistrationResponsesModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['registration-responses', eventId, registrationId],
    queryFn: async () => {
      if (!registrationId) return null;
      const res = await apiClient<{ data: any[] }>(`/v1/events/${eventId}/registrations/${registrationId}/responses`);
      return res.data;
    },
    enabled: !!registrationId,
  });

  return (
    <Modal
      isOpen={!!registrationId}
      onClose={onClose}
      title="REGISTRATION RESPONSES"
    >
      <div className="p-6">
        {isLoading ? (
          <div className="text-zinc-500 dark:text-[#a0a4b8] font-mono text-sm uppercase tracking-widest text-center py-8">
            Loading responses...
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-zinc-500 dark:text-[#a0a4b8] font-mono text-sm uppercase tracking-widest text-center py-8 border-2 border-dashed border-black/10 dark:border-white/20 bg-zinc-50 dark:bg-[#141721]">
            No custom responses found for this registration.
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((response) => (
              <div key={response.id} className="border-2 border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141721] p-4 shadow-[2px_2px_0px_#0A0D14] dark:shadow-[2px_2px_0px_#000]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-[#a0a4b8] mb-1">
                  {response.fieldDefinition?.label || 'Unknown Field'}
                </div>
                <div className="font-mono text-sm text-zinc-900 dark:text-[#F5F5F2]">
                  {response.fieldDefinition?.fieldType === 'URL' ? (
                    <a href={response.value} target="_blank" rel="noopener noreferrer" className="text-[#0057FF] dark:text-[#00E5FF] hover:underline break-all">
                      {response.value}
                    </a>
                  ) : (
                    <span className="break-words">{response.value || '-'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-black dark:border-white text-zinc-900 dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-mono font-bold text-xs uppercase tracking-widest transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </Modal>
  );
}
