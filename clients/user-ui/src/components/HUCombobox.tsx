"use client";

import { Fragment, useMemo, useState } from "react";
import { Combobox, Transition } from "@headlessui/react";

export type HUOption = { value: string; label: string; subLabel?: string };

type Props = {
  value: string | null;                      // id terpilih
  onValueChange: (v: string | null) => void; // callback set id
  options: HUOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export default function HUComboBox({
  value,
  onValueChange,
  options,
  placeholder = "Pilih…",
  emptyText = "Tidak ada hasil",
  disabled = false,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) =>
      [o.label, o.subLabel].some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [options, query]);

  return (
    <div className={className}>
      <Combobox
        value={selected}
        onChange={(opt: HUOption | null) => onValueChange(opt?.value ?? null)}
        disabled={disabled}
      >
        <div className="relative">
          {/* INPUT SELALU BISA DIKETIK */}
          <div className="relative">
            <Combobox.Input
              className="w-full rounded-md border px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              displayValue={(opt: HUOption) => opt?.label ?? ""}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
            />

            {/* Tombol clear */}
            <button
              type="button"
              className="absolute inset-y-0 right-8 my-auto h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100"
              onClick={() => onValueChange(null)}
              disabled={disabled || !value}
              aria-label="Kosongkan"
              title="Kosongkan"
            >
              {/* Ikon X (SVG inline) */}
              <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Caret untuk toggle options */}
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2">
              {/* Chevron (SVG inline) */}
              <svg viewBox="0 0 20 20" className="h-5 w-5 opacity-60 bg-white" aria-hidden="true">
                <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Combobox.Button>
          </div>

          {/* DROPDOWN */}
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Combobox.Options className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg focus:outline-none">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
              ) : (
                filtered.map((o) => (
                  <Combobox.Option
                    key={o.value}
                    value={o}
                    className={({ active }) =>
                      `cursor-pointer select-none px-3 py-2 ${active ? "bg-blue-50" : ""}`
                    }
                  >
                    {({ selected }) => (
                      <div className="flex items-start gap-2">
                        {/* Check (SVG inline) */}
                        <svg
                          viewBox="0 0 24 24"
                          className={`mt-0.5 h-5 w-5 ${selected ? "opacity-100" : "opacity-0"}`}
                          aria-hidden="true"
                        >
                          <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div className="flex flex-col">
                          <span className="truncate">{o.label}</span>
                          {o.subLabel ? (
                            <span className="text-xs text-gray-500 truncate">{o.subLabel}</span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </Combobox.Option>
                ))
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  );
}