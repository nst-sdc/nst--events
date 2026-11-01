import React, { useState } from 'react';
import type { FieldType } from '../../hooks/useFieldDefinitions';

interface QuestionCardPreviewProps {
  label: string;
  fieldType: FieldType;
  options?: string[] | null;
  isRequired: boolean;
  theme?: 'antd' | 'student';
}

export function QuestionCardPreview({
  label,
  fieldType,
  options = [],
  isRequired,
  theme = 'antd',
}: QuestionCardPreviewProps) {
  const [testValue, setTestValue] = useState<string>('');
  const opts = options || [];

  if (theme === 'student') {
    return (
      <div className="p-3 bg-zinc-50 dark:bg-[#090a0f] border border-black/10 dark:border-white/10 rounded-none space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600 dark:text-[#a0a4b8]">
          <span className="uppercase tracking-wider">Interactive Student Preview</span>
          <span className="text-[#0057FF] dark:text-[#00E5FF] font-bold">{fieldType}</span>
        </div>

        {(fieldType === 'TEXT' ||
          fieldType === 'URL' ||
          fieldType === 'EMAIL' ||
          fieldType === 'NUMBER' ||
          fieldType === 'PHONE') && (
          <input
            type={
              fieldType === 'NUMBER'
                ? 'number'
                : fieldType === 'EMAIL'
                  ? 'email'
                  : fieldType === 'PHONE'
                    ? 'tel'
                    : fieldType === 'URL'
                      ? 'url'
                      : 'text'
            }
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder={
              fieldType === 'URL'
                ? 'https://example.com'
                : fieldType === 'EMAIL'
                  ? 'student@adypu.edu.in'
                  : fieldType === 'PHONE'
                    ? '+91 98765 43210'
                    : fieldType === 'NUMBER'
                      ? '42'
                      : 'Type response here...'
            }
            className="w-full bg-white dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-1.5 text-zinc-950 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
          />
        )}

        {fieldType === 'SELECT' && (
          <select
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            className="w-full bg-white dark:bg-[#141721] border border-black/20 dark:border-white/20 px-3 py-1.5 text-zinc-950 dark:text-white font-mono text-xs focus:border-[#0057FF] focus:outline-none"
          >
            <option value="">Select option...</option>
            {opts.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}

        {fieldType === 'RADIO' && (
          <div className="space-y-1.5 pt-1">
            {opts.map((opt, i) => (
              <label
                key={i}
                className="flex items-center gap-2 text-xs font-mono text-zinc-900 dark:text-[#F5F5F2] cursor-pointer"
              >
                <input
                  type="radio"
                  name={`preview_radio_${label}`}
                  checked={testValue === opt}
                  onChange={() => setTestValue(opt)}
                  className="accent-[#0057FF]"
                />
                <span>{opt}</span>
              </label>
            ))}
            {opts.length === 0 && (
              <span className="text-xs font-mono text-zinc-400 dark:text-white/40 italic">No options defined</span>
            )}
          </div>
        )}

        {fieldType === 'MULTI_SELECT' && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {opts.map((opt, i) => {
              const selected = (() => {
                try {
                  const arr = JSON.parse(testValue || '[]');
                  return Array.isArray(arr) && arr.includes(opt);
                } catch {
                  return false;
                }
              })();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    let current: string[] = [];
                    try {
                      current = JSON.parse(testValue || '[]');
                    } catch {}
                    const next = current.includes(opt)
                      ? current.filter((x) => x !== opt)
                      : [...current, opt];
                    setTestValue(JSON.stringify(next));
                  }}
                  className={`px-2 py-1 text-[11px] font-mono border transition-all ${
                    selected
                      ? 'bg-[#0057FF] border-[#0057FF] text-white font-bold'
                      : 'bg-white dark:bg-[#141721] border-black/20 dark:border-white/20 text-zinc-700 dark:text-[#a0a4b8] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
            {opts.length === 0 && (
              <span className="text-xs font-mono text-zinc-400 dark:text-white/40 italic">No options defined</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Ant Design style for Faculty Admin
  return (
    <div
      style={{
        padding: '10px 14px',
        backgroundColor: 'var(--surface-sunken, rgba(0, 0, 0, 0.04))',
        border: '1px dashed var(--border-default, rgba(0, 0, 0, 0.15))',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: 11,
          color: 'var(--text-muted, #667085)',
        }}
      >
        <span style={{ fontWeight: 500, letterSpacing: '0.02em' }}>Student Form Preview</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(0, 87, 255, 0.1)',
            color: '#0057FF',
            border: '1px solid rgba(0, 87, 255, 0.25)',
          }}
        >
          {fieldType}
        </span>
      </div>

      {(fieldType === 'TEXT' ||
        fieldType === 'URL' ||
        fieldType === 'EMAIL' ||
        fieldType === 'NUMBER' ||
        fieldType === 'PHONE') && (
        <input
          type={
            fieldType === 'NUMBER'
              ? 'number'
              : fieldType === 'EMAIL'
                ? 'email'
                : fieldType === 'PHONE'
                  ? 'tel'
                  : fieldType === 'URL'
                    ? 'url'
                    : 'text'
          }
          value={testValue}
          onChange={(e) => setTestValue(e.target.value)}
          placeholder={
            fieldType === 'URL'
              ? 'https://example.com'
              : fieldType === 'EMAIL'
                ? 'student@adypu.edu.in'
                : fieldType === 'PHONE'
                  ? '+91 98765 43210'
                  : fieldType === 'NUMBER'
                    ? '42'
                    : 'Type answer...'
          }
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: 13,
            backgroundColor: 'var(--surface-card, #FFFFFF)',
            border: '1px solid var(--border-default, #E5E7EB)',
            borderRadius: 6,
            color: 'var(--text-primary, #0A0D14)',
            outline: 'none',
          }}
        />
      )}

      {fieldType === 'SELECT' && (
        <select
          value={testValue}
          onChange={(e) => setTestValue(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: 13,
            border: '1px solid var(--border-default, #E5E7EB)',
            borderRadius: 6,
            backgroundColor: 'var(--surface-card, #FFFFFF)',
            color: 'var(--text-primary, #0A0D14)',
            outline: 'none',
          }}
        >
          <option value="" style={{ backgroundColor: 'var(--surface-card, #FFFFFF)', color: 'var(--text-muted, #667085)' }}>Select an option...</option>
          {opts.map((opt, i) => (
            <option key={i} value={opt} style={{ backgroundColor: 'var(--surface-card, #FFFFFF)', color: 'var(--text-primary, #0A0D14)' }}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {fieldType === 'RADIO' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
          {opts.map((opt, i) => (
            <label
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--text-primary, #0A0D14)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name={`antd_preview_radio_${label}`}
                checked={testValue === opt}
                onChange={() => setTestValue(opt)}
                style={{ accentColor: '#0057FF' }}
              />
              <span>{opt}</span>
            </label>
          ))}
          {opts.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted, #667085)', fontStyle: 'italic' }}>
              No options configured
            </span>
          )}
        </div>
      )}

      {fieldType === 'MULTI_SELECT' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {opts.map((opt, i) => {
            const selected = (() => {
              try {
                const arr = JSON.parse(testValue || '[]');
                return Array.isArray(arr) && arr.includes(opt);
              } catch {
                return false;
              }
            })();

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  let current: string[] = [];
                  try {
                    current = JSON.parse(testValue || '[]');
                  } catch {}
                  const next = current.includes(opt)
                    ? current.filter((x) => x !== opt)
                    : [...current, opt];
                  setTestValue(JSON.stringify(next));
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: selected ? '1px solid #0057FF' : '1px solid var(--border-default, #E5E7EB)',
                  backgroundColor: selected ? 'rgba(0, 87, 255, 0.12)' : 'var(--surface-card, #FFFFFF)',
                  color: selected ? '#0057FF' : 'var(--text-secondary, #475467)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {selected ? '✓ ' : ''}{opt}
              </button>
            );
          })}
          {opts.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted, #667085)', fontStyle: 'italic' }}>
              No options configured
            </span>
          )}
        </div>
      )}
    </div>
  );
}
