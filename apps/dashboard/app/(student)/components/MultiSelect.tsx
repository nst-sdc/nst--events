'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, selectedValues, onChange, placeholder = 'Select...', disabled = false }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (disabled) return;
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const displayValue = selectedValues.length === 0
    ? <span className="text-[#a0a4b8]">{placeholder}</span>
    : <span className="text-[#F5F5F2] truncate pr-2 font-medium">
        {selectedValues.map(v => options.find(o => o.value === v)?.label || v).join(', ')}
      </span>;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full flex items-center justify-between text-left bg-[#090a0f] border-2 px-3.5 py-2.5 text-xs font-mono transition-all",
          isOpen ? "border-[#0057FF] shadow-[3px_3px_0px_#0057FF]" : "border-white/20 hover:border-white/40",
          disabled ? "opacity-50 cursor-not-allowed text-[#a0a4b8]" : "text-[#F5F5F2]"
        )}
      >
        <div className="flex-1 overflow-hidden">{displayValue}</div>
        <ChevronDown className="w-4 h-4 text-[#a0a4b8] flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-[#0d0e12] border-2 border-white/20 shadow-[6px_6px_0px_#000000]">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs font-mono text-[#a0a4b8]">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={clsx(
                    "w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-mono border-b border-white/5 last:border-b-0 transition-colors",
                    isSelected ? "bg-[#0057FF]/15 text-white font-bold" : "text-[#a0a4b8] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="truncate pr-2">
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-[#0057FF] shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
