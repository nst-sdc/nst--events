import React, { useState, useEffect, useMemo } from 'react';
import { Send, CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { useEventForm, useSubmitEventForm } from '../../hooks/useEventForms';
import { useProfileValues } from '../../hooks/useProfileValues';
import { Modal } from '../ui/Modal';
import { DynamicFieldInput } from '../forms/DynamicFieldInput';
import {
  validateFormResponses,
  toResponsePayload,
} from '../../lib/form-utils';

interface StudentEventFormModalProps {
  eventId: string;
  formId: string | null;
  formTitle: string;
  purpose: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function StudentEventFormModal({
  eventId,
  formId,
  formTitle,
  purpose,
  onClose,
  onSubmitted,
}: StudentEventFormModalProps) {
  const { data: formDetails, isLoading } = useEventForm(eventId, formId);
  const { data: profileValues } = useProfileValues();
  const { mutateAsync: submitResponses, isPending: isSubmitting } = useSubmitEventForm(eventId);

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());

  // Reset state when formId changes
  useEffect(() => {
    setResponses({});
    setFieldErrors({});
    setErrorMsg(null);
    setIsSuccess(false);
    setPrefilledFields(new Set());
  }, [formId]);

  // Prefill reusable fields from the student's saved profile values
  useEffect(() => {
    if (!formDetails?.fields || !profileValues) return;
    setResponses((prev) => {
      const next = { ...prev };
      const prefilled = new Set<string>();
      for (const field of formDetails.fields) {
        if (next[field.fieldDefinitionId] !== undefined) continue;
        const match = profileValues.find(
          (p) => p.fieldDefinitionId === field.fieldDefinitionId
        );
        if (match && match.value) {
          next[field.fieldDefinitionId] = match.value;
          prefilled.add(field.fieldDefinitionId);
        }
      }
      setPrefilledFields(prefilled);
      return next;
    });
  }, [formDetails, profileValues]);

  const handleFieldChange = (fieldDefId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [fieldDefId]: value,
    }));
    // Clear field-level error when user edits
    if (fieldErrors[fieldDefId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldDefId];
        return next;
      });
    }
  };

  const isClosed = useMemo(() => {
    if (!formDetails?.closeAt) return false;
    return new Date(formDetails.closeAt) <= new Date();
  }, [formDetails?.closeAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || !formDetails) return;
    setErrorMsg(null);

    if (isClosed) {
      setErrorMsg('This form has closed for submissions.');
      return;
    }

    // Comprehensive client-side validation
    const validation = validateFormResponses(formDetails.fields, responses);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setErrorMsg(validation.firstError || 'Please fix the errors indicated below.');
      return;
    }

    setFieldErrors({});
    const formattedResponses = toResponsePayload(responses);

    try {
      await submitResponses({
        formId,
        responses: formattedResponses,
      });
      setIsSuccess(true);
      if (onSubmitted) onSubmitted();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit form. Please check your answers and try again.');
    }
  };

  return (
    <Modal
      isOpen={!!formId}
      onClose={onClose}
      title={`${purpose} // ${formTitle}`}
      maxWidth="max-w-2xl"
    >
      <div className="p-6">
        {isSuccess ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-[#00E5FF] mx-auto mb-4 animate-bounce" />
            <h3 className="font-mono text-lg font-bold text-white uppercase tracking-wider">
              TRANSMISSION SUCCESSFUL
            </h3>
            <p className="font-mono text-xs text-[#a0a4b8] mt-2">
              Your responses have been recorded in the event ledger.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-16 text-center font-mono text-xs text-[#a0a4b8] uppercase tracking-widest">
            LOADING EVENT FORM SPECIFICATIONS...
          </div>
        ) : !formDetails || formDetails.fields.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-mono text-xs text-[#a0a4b8] uppercase">
              No input fields configured for this form.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-6 py-2 border-2 border-white text-white font-mono text-xs uppercase font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {isClosed ? (
              <div className="p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>FORM CLOSED: The submission deadline has passed ({new Date(formDetails.closeAt!).toLocaleString()}).</span>
              </div>
            ) : formDetails.closeAt ? (
              <div className="p-3 bg-[#FFE600]/10 border border-[#FFE600]/30 font-mono text-[11px] text-[#FFE600] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                DEADLINE: {new Date(formDetails.closeAt).toLocaleString()}
              </div>
            ) : null}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-2">
              {formDetails.fields.map((field) => (
                <DynamicFieldInput
                  key={field.id}
                  field={field}
                  value={responses[field.fieldDefinitionId] || ''}
                  onChange={(val) => handleFieldChange(field.fieldDefinitionId, val)}
                  disabled={isSubmitting || isClosed}
                  error={fieldErrors[field.fieldDefinitionId]}
                  isPrefilled={prefilledFields.has(field.fieldDefinitionId)}
                />
              ))}
            </div>

            <div className="pt-4 border-t-2 border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono text-xs font-bold uppercase transition-colors"
              >
                {isClosed ? 'Close' : 'Cancel'}
              </button>
              {!isClosed && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-[#0057FF] text-white hover:bg-[#0042c7] border-2 border-black font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-[3px_3px_0px_#000] disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'TRANSMITTING...' : 'TRANSMIT RESPONSES ↗'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
