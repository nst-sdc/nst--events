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
          <div className="text-[#a0a4b8] font-mono text-sm uppercase tracking-widest text-center py-8">
            Loading responses...
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-[#a0a4b8] font-mono text-sm uppercase tracking-widest text-center py-8 border-2 border-dashed border-white/20 bg-[#141721]">
            No custom responses found for this registration.
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((response) => (
              <div key={response.id} className="border-2 border-white/10 bg-[#141721] p-4">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#a0a4b8] mb-1">
                  {response.fieldDefinition?.label || 'Unknown Field'}
                </div>
                <div className="font-mono text-sm text-[#F5F5F2]">
                  {response.fieldDefinition?.fieldType === 'URL' ? (
                    <a href={response.value} target="_blank" rel="noopener noreferrer" className="text-[#00E5FF] hover:underline break-all">
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
            className="px-6 py-2 border-2 border-white text-white hover:bg-white hover:text-black font-mono font-bold text-xs uppercase tracking-widest transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </Modal>
  );
}
