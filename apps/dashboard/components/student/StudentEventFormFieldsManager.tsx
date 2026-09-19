import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
import { useFieldDefinitions, useCreateFieldDefinition, FieldDefinition } from '../../hooks/useFieldDefinitions';
import { useEventFormFields, useUpdateEventFormFields, EventFormField } from '../../hooks/useEventFormFields';
import { Modal } from '../ui/Modal';

export function StudentEventFormFieldsManager({ eventId }: { eventId: string }) {
  const { data: allFields, isLoading: isLoadingFields } = useFieldDefinitions();
  const { data: eventFields, isLoading: isLoadingEventFields } = useEventFormFields(eventId);
  const { mutateAsync: updateEventFields, isPending: isUpdating } = useUpdateEventFormFields(eventId);
  const { mutateAsync: createFieldDefinition, isPending: isCreatingField } = useCreateFieldDefinition();

  const [localFields, setLocalFields] = useState<EventFormField[]>([]);
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);

  useEffect(() => {
    if (eventFields) {
      setLocalFields(eventFields);
    }
  }, [eventFields]);

  const handleAddField = (fieldDef: FieldDefinition) => {
    if (localFields.find(f => f.fieldDefinitionId === fieldDef.id)) return;
    setLocalFields([
      ...localFields,
      {
        eventId,
        fieldDefinitionId: fieldDef.id,
        isRequired: true,
        order: localFields.length,
        fieldDefinition: fieldDef,
      }
    ]);
    setIsAddFieldOpen(false);
  };

  const handleRemoveField = (fieldDefId: string) => {
    setLocalFields(localFields.filter(f => f.fieldDefinitionId !== fieldDefId));
  };

  const handleToggleRequired = (fieldDefId: string, isRequired: boolean) => {
    setLocalFields(localFields.map(f => 
      f.fieldDefinitionId === fieldDefId ? { ...f, isRequired } : f
    ));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === localFields.length - 1)) return;
    
    const newFields = [...localFields];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newFields[index];
    newFields[index] = newFields[swapIndex];
    newFields[swapIndex] = temp;
    
    newFields.forEach((f, i) => { f.order = i; });
    setLocalFields(newFields);
  };

  const handleSave = async () => {
    await updateEventFields({
      fields: localFields.map(f => ({
        fieldDefinitionId: f.fieldDefinitionId,
        isRequired: f.isRequired,
        order: f.order,
      })),
    });
  };

  const availableFields = allFields?.filter((f: FieldDefinition) => !localFields.find(lf => lf.fieldDefinitionId === f.id)) || [];

  return (
    <section className="mb-8 border-2 border-white/10 bg-[#0e1017]">
      <div className="bg-[#1a1d29] border-b-2 border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-mono font-bold text-white text-lg tracking-wide uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00E5FF]"></span>
            Registration Form Fields
          </h2>
          <p className="text-sm font-mono text-[#a0a4b8] mt-1">Configure custom questions students must answer when registering.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsCreateFieldOpen(true)}
            className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-white hover:border-white font-mono font-bold text-xs tracking-widest uppercase transition-all"
          >
            Create New
          </button>
          <button 
            type="button"
            onClick={() => setIsAddFieldOpen(true)}
            className="px-4 py-2 bg-[#00E5FF] text-black border-2 border-[#00E5FF] hover:bg-[#00b8cc] hover:border-[#00b8cc] font-mono font-bold text-xs tracking-widest uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] transition-all"
          >
            <Plus className="w-3 h-3" /> Add Field
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoadingEventFields ? (
          <p className="font-mono text-sm text-[#a0a4b8]">Loading form fields...</p>
        ) : localFields.length === 0 ? (
          <div className="border-2 border-dashed border-white/20 p-8 text-center bg-[#141721]">
            <p className="font-mono text-sm text-[#a0a4b8] mb-4">No custom form fields configured for this event.</p>
            <button 
              type="button"
              onClick={() => setIsAddFieldOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF]/10 font-mono font-bold text-xs tracking-widest uppercase transition-all"
            >
              <Plus className="w-3 h-3" /> Select Fields to Add
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {localFields.map((field, index) => (
              <div key={field.fieldDefinitionId} className="flex items-center justify-between border-2 border-white/10 bg-[#141721] p-4 group hover:border-[#00E5FF]/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button 
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="text-[#a0a4b8] hover:text-[#00E5FF] disabled:opacity-30 disabled:hover:text-[#a0a4b8] transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      disabled={index === localFields.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="text-[#a0a4b8] hover:text-[#00E5FF] disabled:opacity-30 disabled:hover:text-[#a0a4b8] transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-[#F5F5F2] text-sm uppercase">{field.fieldDefinition.label}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="font-mono text-[10px] text-[#a0a4b8] tracking-widest uppercase">
                        Type: {field.fieldDefinition.fieldType}
                      </span>
                      {field.fieldDefinition.isReusable && (
                        <span className="font-mono text-[10px] text-[#00E5FF] border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-1.5 py-0.5 uppercase tracking-widest">
                          Reusable
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="font-mono text-[10px] font-bold text-[#a0a4b8] tracking-widest uppercase">Required</span>
                    <input 
                      type="checkbox"
                      checked={field.isRequired}
                      onChange={(e) => handleToggleRequired(field.fieldDefinitionId, e.target.checked)}
                      className="w-4 h-4 rounded-sm border-2 border-white/20 bg-[#0e1017] text-[#00E5FF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field.fieldDefinitionId)}
                    className="text-[#ff3b3b] hover:text-[#ff0000] p-2 border-2 border-transparent hover:border-[#ff3b3b]/30 bg-transparent hover:bg-[#ff3b3b]/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            <div className="pt-4 flex justify-end">
              <button 
                type="button"
                onClick={handleSave}
                disabled={isUpdating}
                className="px-6 py-2 bg-[#0057FF] text-white hover:bg-[#0042c7] border-2 border-[#0057FF] font-mono font-bold text-xs tracking-widest uppercase flex items-center gap-2 shadow-[3px_3px_0px_#000] disabled:opacity-50 transition-all"
              >
                <Save className="w-4 h-4" />
                {isUpdating ? 'Saving...' : 'Save Fields'}
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isAddFieldOpen} onClose={() => setIsAddFieldOpen(false)} title="ADD FORM FIELD">
        <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoadingFields ? (
             <p className="font-mono text-sm text-[#a0a4b8]">Loading...</p>
          ) : availableFields.length === 0 ? (
            <p className="font-mono text-sm text-[#a0a4b8]">No available fields to add.</p>
          ) : (
            availableFields.map((f: FieldDefinition) => (
              <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-2 border-white/10 bg-[#141721] gap-4">
                <div>
                  <h4 className="font-mono font-bold text-white text-sm uppercase">{f.label}</h4>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="font-mono text-[10px] text-[#a0a4b8] tracking-widest uppercase">
                      {f.fieldType}
                    </span>
                    {f.isReusable && (
                      <span className="font-mono text-[10px] text-[#00E5FF] uppercase tracking-widest">
                        Reusable
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => handleAddField(f)}
                  className="px-4 py-2 border-2 border-white/20 text-[#a0a4b8] hover:text-[#00E5FF] hover:border-[#00E5FF] font-mono font-bold text-[10px] tracking-widest uppercase transition-all whitespace-nowrap"
                >
                  ADD TO EVENT
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Basic modal for create field (can be expanded later if needed for full student creation) */}
      <Modal isOpen={isCreateFieldOpen} onClose={() => setIsCreateFieldOpen(false)} title="CREATE NEW FIELD">
         <div className="mt-4 p-4 border-2 border-[#ffb000]/30 bg-[#ffb000]/10">
           <p className="font-mono text-sm text-[#ffb000]">Creating new field definitions from the student dashboard is restricted. Please use the platform admin UI or contact an administrator.</p>
         </div>
      </Modal>
    </section>
  );
}
