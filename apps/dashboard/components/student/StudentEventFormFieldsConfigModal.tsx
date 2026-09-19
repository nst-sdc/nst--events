import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Check, X, Sliders, AlertCircle } from 'lucide-react';
import { useFieldDefinitions, useCreateFieldDefinition, FieldDefinition } from '../../hooks/useFieldDefinitions';
import { useEventForm, useUpdateEventFormFields, EventFormField } from '../../hooks/useEventForms';
import { Modal } from '../ui/Modal';

interface StudentEventFormFieldsConfigModalProps {
  eventId: string;
  formId: string | null;
  formTitle: string;
  onClose: () => void;
}

export function StudentEventFormFieldsConfigModal({
  eventId,
  formId,
  formTitle,
  onClose,
}: StudentEventFormFieldsConfigModalProps) {
  const { data: formDetails, isLoading: isLoadingForm } = useEventForm(eventId, formId);
  const { data: allFields, isLoading: isLoadingFields } = useFieldDefinitions();
  const { mutateAsync: updateFields, isPending: isSaving } = useUpdateEventFormFields(eventId);
  const { mutateAsync: createFieldDefinition, isPending: isCreatingField } = useCreateFieldDefinition();

  const [localFields, setLocalFields] = useState<EventFormField[]>([]);
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New field state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('TEXT');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldReusable, setNewFieldReusable] = useState(true);

  useEffect(() => {
    if (formDetails?.fields) {
      setLocalFields(formDetails.fields);
    } else {
      setLocalFields([]);
    }
  }, [formDetails]);

  const handleAddField = (fieldDef: FieldDefinition) => {
    if (localFields.some(f => f.fieldDefinitionId === fieldDef.id)) return;

    setLocalFields([
      ...localFields,
      {
        id: `temp-${Date.now()}`,
        eventId,
        formId,
        fieldDefinitionId: fieldDef.id,
        isRequired: true,
        order: localFields.length,
        createdAt: new Date().toISOString(),
        fieldDefinition: fieldDef,
      },
    ]);
    setIsAddFieldOpen(false);
  };

  const handleRemoveField = (fieldDefId: string) => {
    setLocalFields(localFields.filter(f => f.fieldDefinitionId !== fieldDefId));
  };

  const handleToggleRequired = (fieldDefId: string) => {
    setLocalFields(
      localFields.map(f =>
        f.fieldDefinitionId === fieldDefId ? { ...f, isRequired: !f.isRequired } : f
      )
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localFields.length - 1)
    ) {
      return;
    }

    const newFields = [...localFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newFields[index];
    newFields[index] = newFields[swapIndex];
    newFields[swapIndex] = temp;

    newFields.forEach((f, i) => {
      f.order = i;
    });

    setLocalFields(newFields);
  };

  const handleSave = async () => {
    if (!formId) return;
    setErrorMessage(null);
    try {
      await updateFields({
        formId,
        fields: localFields.map(f => ({
          fieldDefinitionId: f.fieldDefinitionId,
          isRequired: f.isRequired,
          order: f.order,
        })),
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save form fields');
    }
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel || !newFieldKey) return;

    try {
      const created = await createFieldDefinition({
        label: newFieldLabel,
        key: newFieldKey.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        fieldType: newFieldType as any,
        options: ['SELECT', 'MULTI_SELECT', 'RADIO'].includes(newFieldType)
          ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        isReusable: newFieldReusable,
      });

      if (created?.id) {
        handleAddField(created);
      }

      setIsCreateFieldOpen(false);
      setNewFieldLabel('');
      setNewFieldKey('');
      setNewFieldType('TEXT');
      setNewFieldOptions('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create field definition');
    }
  };

  const availableFields =
    allFields?.filter(f => !localFields.some(lf => lf.fieldDefinitionId === f.id)) || [];

  return (
    <Modal
      isOpen={!!formId}
      onClose={onClose}
      title={`CONFIGURE FIELDS: ${formTitle}`}
      maxWidth="max-w-3xl"
    >
      <div className="p-6">
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border-2 border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-white/10 mb-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#a0a4b8]">
              {localFields.length} FIELD{localFields.length === 1 ? '' : 'S'} DEFINED
            </div>
            <p className="text-xs text-[#a0a4b8] mt-0.5">
              Customize questions and inputs students will respond to.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateFieldOpen(true)}
              className="px-3 py-1.5 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs uppercase tracking-wider transition-all"
            >
              + Create Custom
            </button>
            <button
              type="button"
              onClick={() => setIsAddFieldOpen(true)}
              className="px-4 py-1.5 bg-[#00E5FF] text-black border-2 border-[#00E5FF] hover:bg-[#00b8cc] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#000] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>
        </div>

        {isLoadingForm ? (
          <div className="text-[#a0a4b8] font-mono text-xs uppercase tracking-widest text-center py-12">
            Loading form fields...
          </div>
        ) : localFields.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-white/15 bg-[#141721] p-6">
            <Sliders className="w-8 h-8 text-[#a0a4b8] mx-auto mb-2 opacity-50" />
            <div className="font-mono text-sm text-[#F5F5F2] uppercase tracking-wider">
              No fields configured yet
            </div>
            <p className="text-xs text-[#a0a4b8] mt-1 mb-4">
              Add fields from the library or create custom questions for this form.
            </p>
            <button
              type="button"
              onClick={() => setIsAddFieldOpen(true)}
              className="px-4 py-2 bg-[#00E5FF] text-black font-mono font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000]"
            >
              Add Your First Field
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {localFields.map((field, idx) => (
              <div
                key={field.fieldDefinitionId}
                className="flex items-center justify-between p-3.5 bg-[#141721] border-2 border-white/10 hover:border-white/25 transition-all gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 border border-white/10 hover:border-white/30 text-[#a0a4b8] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === localFields.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 border border-white/10 hover:border-white/30 text-[#a0a4b8] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-white font-bold truncate">
                      {field.fieldDefinition?.label || 'Untitled Field'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] uppercase text-[#00E5FF] tracking-wider px-1.5 py-0.5 bg-[#00E5FF]/10 border border-[#00E5FF]/30">
                        {field.fieldDefinition?.fieldType || 'TEXT'}
                      </span>
                      <span className="font-mono text-[10px] text-[#a0a4b8] truncate">
                        key: {field.fieldDefinition?.key}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRequired(field.fieldDefinitionId)}
                    className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider border-2 transition-all ${
                      field.isRequired
                        ? 'bg-[#FFE600]/10 border-[#FFE600] text-[#FFE600]'
                        : 'border-white/20 text-[#a0a4b8] hover:text-white'
                    }`}
                  >
                    {field.isRequired ? 'REQUIRED' : 'OPTIONAL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field.fieldDefinitionId)}
                    className="p-1.5 border border-white/10 hover:border-[#FF3B30] text-[#a0a4b8] hover:text-[#FF3B30] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 pt-4 border-t-2 border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white font-mono font-bold text-xs uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2 border-2 font-mono font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all ${
              saveSuccess
                ? 'bg-[#00E5FF] text-black border-[#00E5FF]'
                : 'bg-white text-black border-white hover:bg-[#FFE600] hover:border-[#FFE600]'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Fields'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Existing Field Modal */}
      {isAddFieldOpen && (
        <Modal
          isOpen={isAddFieldOpen}
          onClose={() => setIsAddFieldOpen(false)}
          title="ADD EXISTING FIELD"
          maxWidth="max-w-md"
        >
          <div className="p-6 space-y-3">
            {availableFields.length === 0 ? (
              <div className="text-center py-6 text-[#a0a4b8] font-mono text-xs uppercase tracking-wider">
                No more unassigned fields.
              </div>
            ) : (
              availableFields.map(field => (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-3 bg-[#141721] border border-white/10"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-white">{field.label}</div>
                    <div className="font-mono text-[10px] text-[#a0a4b8]">{field.fieldType}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddField(field)}
                    className="px-3 py-1 bg-[#00E5FF] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00b8cc]"
                  >
                    Add
                  </button>
                </div>
              ))
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddFieldOpen(false)}
                className="w-full py-2 border border-white/20 text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Custom Field Modal */}
      {isCreateFieldOpen && (
        <Modal
          isOpen={isCreateFieldOpen}
          onClose={() => setIsCreateFieldOpen(false)}
          title="CREATE CUSTOM FIELD"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateField} className="p-6 space-y-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Question / Label
              </label>
              <input
                type="text"
                required
                value={newFieldLabel}
                onChange={e => {
                  setNewFieldLabel(e.target.value);
                  if (!newFieldKey) {
                    setNewFieldKey(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '_')
                        .slice(0, 30)
                    );
                  }
                }}
                placeholder="e.g. GitHub Repository, T-Shirt Size"
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Field Key (Unique identifier)
              </label>
              <input
                type="text"
                required
                value={newFieldKey}
                onChange={e => setNewFieldKey(e.target.value)}
                placeholder="e.g. github_repo"
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                Field Type
              </label>
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value)}
                className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
              >
                <option value="TEXT">Text (Single line)</option>
                <option value="URL">URL / Link</option>
                <option value="EMAIL">Email</option>
                <option value="NUMBER">Number</option>
                <option value="PHONE">Phone Number</option>
                <option value="SELECT">Select Dropdown</option>
                <option value="MULTI_SELECT">Multi-Select (Checkboxes)</option>
                <option value="RADIO">Radio Buttons</option>
              </select>
            </div>

            {['SELECT', 'MULTI_SELECT', 'RADIO'].includes(newFieldType) && (
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-[#a0a4b8] mb-1">
                  Options (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={newFieldOptions}
                  onChange={e => setNewFieldOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full bg-[#141721] border-2 border-white/15 px-3 py-2 text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="reusable"
                checked={newFieldReusable}
                onChange={e => setNewFieldReusable(e.target.checked)}
                className="accent-[#00E5FF]"
              />
              <label htmlFor="reusable" className="font-mono text-xs text-[#a0a4b8]">
                Make reusable for future events
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsCreateFieldOpen(false)}
                className="px-4 py-2 border border-white/20 text-[#a0a4b8] hover:text-white font-mono text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingField}
                className="px-5 py-2 bg-[#00E5FF] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#00b8cc] shadow-[2px_2px_0px_#000]"
              >
                {isCreatingField ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
