import React from 'react';
import { CheckSquare, Square, AlertCircle, Sparkles } from 'lucide-react';
export interface DynamicFormFieldInputItem {
  fieldDefinitionId: string;
  isRequired: boolean;
  order?: number;
  fieldDefinition: {
    id?: string;
    label: string;
    key?: string;
    fieldType: string;
    isReusable?: boolean;
    options?: string[] | null;
  };
}

interface DynamicFieldInputProps {
  field: DynamicFormFieldInputItem;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  isPrefilled?: boolean;
}

export function DynamicFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
  isPrefilled,
}: DynamicFieldInputProps) {
  const def = field.fieldDefinition;
  const options = def.options || [];

  const handleMultiSelectToggle = (option: string) => {
    let current: string[] = [];
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (Array.isArray(parsed)) current = parsed;
    } catch {
      current = [];
    }
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    onChange(JSON.stringify(next));
  };

  const borderClass = error
    ? 'border-[#FF3B30] focus:border-[#FF3B30]'
    : 'border-black/20 dark:border-white/15 focus:border-[#0057FF] dark:focus:border-[#00E5FF]';

  const inputClasses = `w-full bg-white dark:bg-[#090a0f] border-2 ${borderClass} px-3 py-2 text-zinc-950 dark:text-white font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF] dark:focus-visible:ring-[#00E5FF] focus-visible:ring-offset-2 disabled:opacity-50 transition-colors`;

  return (
    <div
      className={`p-4 bg-zinc-50 dark:bg-[#141721] border-2 ${
        error ? 'border-[#FF3B30]/60' : 'border-black/10 dark:border-white/10'
      } space-y-2 hover:border-black/20 dark:hover:border-white/20 transition-all`}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <label className="font-mono text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
          <span>{def.label}</span>
          {field.isRequired && <span className="text-[#FF3B30]">*</span>}
          {isPrefilled && (
            <span className="font-mono text-[9px] text-[#0057FF] dark:text-[#C8FF00] bg-[#0057FF]/10 dark:bg-[#C8FF00]/10 border border-[#0057FF]/30 dark:border-[#C8FF00]/30 px-1.5 py-0.2 rounded-none inline-flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              PROFILE
            </span>
          )}
        </label>
        <span className="font-mono text-[10px] text-[#0057FF] dark:text-[#00E5FF] tracking-wider uppercase">
          {def.fieldType}
        </span>
      </div>

      {(def.fieldType === 'TEXT' ||
        def.fieldType === 'URL' ||
        def.fieldType === 'EMAIL' ||
        def.fieldType === 'NUMBER' ||
        def.fieldType === 'PHONE') && (
        <input
          type={
            def.fieldType === 'NUMBER'
              ? 'number'
              : def.fieldType === 'EMAIL'
                ? 'email'
                : def.fieldType === 'PHONE'
                  ? 'tel'
                  : def.fieldType === 'URL'
                    ? 'url'
                    : 'text'
          }
          disabled={disabled}
          required={field.isRequired}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            def.fieldType === 'URL'
              ? 'https://...'
              : def.fieldType === 'EMAIL'
                ? 'name@example.com'
                : def.fieldType === 'PHONE'
                  ? '+1 (555) 000-0000'
                  : def.fieldType === 'NUMBER'
                    ? '0'
                    : 'Type your response...'
          }
          className={inputClasses}
        />
      )}

      {def.fieldType === 'SELECT' && (
        <select
          disabled={disabled}
          required={field.isRequired}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">Select an option...</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {def.fieldType === 'RADIO' && (
        <div className="space-y-2 pt-1">
          {options.map((opt, i) => {
            const isSelected = value === opt;
            return (
              <label
                key={i}
                onClick={() => !disabled && onChange(opt)}
                className={`flex items-center gap-2.5 p-2.5 border cursor-pointer font-mono text-xs transition-all ${
                  isSelected
                    ? 'bg-[#0057FF]/10 dark:bg-[#00E5FF]/10 border-[#0057FF] dark:border-[#00E5FF] text-zinc-950 dark:text-white'
                    : 'bg-white dark:bg-[#090a0f] border-black/10 dark:border-white/10 text-zinc-600 dark:text-[#a0a4b8] hover:border-black/30 dark:hover:border-white/30'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-[#0057FF] dark:border-[#00E5FF]' : 'border-zinc-400 dark:border-white/30'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-[#0057FF] dark:bg-[#00E5FF]" />}
                </div>
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {def.fieldType === 'MULTI_SELECT' && (
        <div className="space-y-2 pt-1">
          {options.map((opt, i) => {
            let selectedList: string[] = [];
            try {
              const parsed = value ? JSON.parse(value) : [];
              if (Array.isArray(parsed)) selectedList = parsed;
            } catch {
              selectedList = [];
            }
            const isChecked = selectedList.includes(opt);
            return (
              <label
                key={i}
                onClick={() => !disabled && handleMultiSelectToggle(opt)}
                className={`flex items-center gap-2.5 p-2.5 border cursor-pointer font-mono text-xs transition-all ${
                  isChecked
                    ? 'bg-[#0057FF]/10 dark:bg-[#00E5FF]/10 border-[#0057FF] dark:border-[#00E5FF] text-zinc-950 dark:text-white'
                    : 'bg-white dark:bg-[#090a0f] border-black/10 dark:border-white/10 text-zinc-600 dark:text-[#a0a4b8] hover:border-black/30 dark:hover:border-white/30'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-[#0057FF] dark:text-[#00E5FF] shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-400 dark:text-white/30 shrink-0" />
                )}
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-[11px] text-[#FF3B30] font-mono flex items-center gap-1.5 pt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
