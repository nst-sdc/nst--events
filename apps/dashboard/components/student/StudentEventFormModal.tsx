import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, AlertCircle, Clock, Link as LinkIcon, CheckSquare, Square, Radio } from 'lucide-react';
import { useEventForm, useSubmitEventForm } from '../../hooks/useEventForms';
import { Modal } from '../ui/Modal';

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
  const { mutateAsync: submitResponses, isPending: isSubmitting } = useSubmitEventForm(eventId);

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when formId changes
  useEffect(() => {
    setResponses({});
    setErrorMsg(null);
    setIsSuccess(false);
  }, [formId]);

  const handleFieldChange = (fieldDefId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [fieldDefId]: value,
    }));
  };

  const handleMultiSelectToggle = (fieldDefId: string, option: string) => {
    const current: string[] = Array.isArray(responses[fieldDefId]) ? responses[fieldDefId] : [];
    const exists = current.includes(option);
    const updated = exists ? current.filter(o => o !== option) : [...current, option];
    handleFieldChange(fieldDefId, updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || !formDetails) return;
    setErrorMsg(null);

    // Validate required fields
    for (const field of formDetails.fields) {
      if (field.isRequired) {
        const val = responses[field.fieldDefinitionId];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          setErrorMsg(`Please answer required question: "${field.fieldDefinition.label}"`);
          return;
        }
      }
    }

    // Format payload
    const formattedResponses = formDetails.fields
      .filter(f => responses[f.fieldDefinitionId] !== undefined && responses[f.fieldDefinitionId] !== '')
      .map(f => {
        const val = responses[f.fieldDefinitionId];
        const stringVal = Array.isArray(val) ? JSON.stringify(val) : String(val);
        return {
          fieldDefinitionId: f.fieldDefinitionId,
          value: stringVal,
        };
      });

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
      setErrorMsg(err.message || 'Failed to submit form');
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
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {formDetails.closeAt && (
              <div className="p-3 bg-[#FFE600]/10 border border-[#FFE600]/30 font-mono text-[11px] text-[#FFE600] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                DEADLINE: {new Date(formDetails.closeAt).toLocaleString()}
              </div>
            )}

            <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-2">
              {formDetails.fields.map(field => {
                const def = field.fieldDefinition;
                const value = responses[field.fieldDefinitionId] ?? '';

                return (
                  <div
                    key={field.id}
                    className="p-4 bg-[#141721] border-2 border-white/10 space-y-2 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <label className="font-mono text-xs font-bold text-white uppercase tracking-wide">
                        {def.label} {field.isRequired && <span className="text-[#FF3B30]">*</span>}
                      </label>
                      <span className="font-mono text-[10px] text-[#00E5FF] tracking-wider uppercase">
                        {def.fieldType}
                      </span>
                    </div>

                    {/* Render input based on field type */}
                    {def.fieldType === 'TEXT' && (
                      <input
                        type="text"
                        required={field.isRequired}
                        value={value}
                        onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                        placeholder="Type your response..."
                        className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                      />
                    )}

                    {def.fieldType === 'URL' && (
                      <div className="relative">
                        <input
                          type="url"
                          required={field.isRequired}
                          value={value}
                          onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                        />
                      </div>
                    )}

                    {def.fieldType === 'EMAIL' && (
                      <input
                        type="email"
                        required={field.isRequired}
                        value={value}
                        onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                      />
                    )}

                    {def.fieldType === 'NUMBER' && (
                      <input
                        type="number"
                        required={field.isRequired}
                        value={value}
                        onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                        placeholder="0"
                        className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                      />
                    )}

                    {def.fieldType === 'PHONE' && (
                      <input
                        type="tel"
                        required={field.isRequired}
                        value={value}
                        onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                      />
                    )}

                    {def.fieldType === 'SELECT' && (
                      <select
                        required={field.isRequired}
                        value={value}
                        onChange={e => handleFieldChange(field.fieldDefinitionId, e.target.value)}
                        className="w-full bg-[#090a0f] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                      >
                        <option value="">Select an option...</option>
                        {(def.options || []).map((opt, i) => (
                          <option key={i} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {def.fieldType === 'RADIO' && (
                      <div className="space-y-2 pt-1">
                        {(def.options || []).map((opt, i) => {
                          const isSelected = value === opt;
                          return (
                            <label
                              key={i}
                              onClick={() => handleFieldChange(field.fieldDefinitionId, opt)}
                              className={`flex items-center gap-2.5 p-2.5 border cursor-pointer font-mono text-xs transition-all ${
                                isSelected
                                  ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                                  : 'bg-[#090a0f] border-white/10 text-[#a0a4b8] hover:border-white/30'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#00E5FF]' : 'border-white/30'}`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-[#00E5FF]" />}
                              </div>
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {def.fieldType === 'MULTI_SELECT' && (
                      <div className="space-y-2 pt-1">
                        {(def.options || []).map((opt, i) => {
                          const selectedList: string[] = Array.isArray(value) ? value : [];
                          const isChecked = selectedList.includes(opt);
                          return (
                            <label
                              key={i}
                              onClick={() => handleMultiSelectToggle(field.fieldDefinitionId, opt)}
                              className={`flex items-center gap-2.5 p-2.5 border cursor-pointer font-mono text-xs transition-all ${
                                isChecked
                                  ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                                  : 'bg-[#090a0f] border-white/10 text-[#a0a4b8] hover:border-white/30'
                              }`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#00E5FF] shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-white/30 shrink-0" />
                              )}
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t-2 border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-xs uppercase tracking-wider transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#00E5FF] text-black border-2 border-[#00E5FF] font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-[2px_2px_0px_#000] hover:bg-[#00cce6] transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'Submitting...' : 'Submit Form'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
