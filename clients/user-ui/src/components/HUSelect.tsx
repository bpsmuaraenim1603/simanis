"use client";

import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";

export type HUSelectOption = {
  value: string;
  label: string;
  subLabel?: string;
};

type Props = {
  value: string | null; // id terpilih
  onValueChange: (v: string | null) => void; // callback set id
  options?: HUSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
};

export default function HUSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Pilih…",
  disabled = false,
  className = "",
  buttonClassName = "",
}: Props) {
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={className}>
      <Listbox
        value={selected}
        onChange={(opt: HUSelectOption | null) =>
          onValueChange(opt?.value ?? null)
        }
        disabled={disabled}
      >
        <div className="relative">
          {/* Trigger */}
          <Listbox.Button
            className={
              "w-full text-left flex items-center justify-between rounded-md border bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
              buttonClassName
            }
          >
            <span className={!selected ? "text-gray-500 truncate" : "truncate"}>
              {selected ? (
                <span className="flex flex-col">
                  <span className="truncate">{selected.label}</span>
                  {selected?.subLabel ? (
                    <span className="text-xs text-gray-500 truncate">
                      {selected.subLabel}
                    </span>
                  ) : null}
                </span>
              ) : (
                placeholder
              )}
            </span>
            {/* Chevron (SVG inline) */}
            <svg
              viewBox="0 0 20 20"
              className="ml-2 h-5 w-5 opacity-60"
              aria-hidden="true"
            >
              <path
                d="M6 8l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Listbox.Button>

          {/* Dropdown */}
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg focus:outline-none">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Tidak ada opsi
                </div>
              ) : (
                options.map((o) => (
                  <Listbox.Option
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
                          <path
                            d="M5 12l4 4L19 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex flex-col">
                          <span className="truncate">{o.label}</span>
                          {o.subLabel ? (
                            <span className="text-xs text-gray-500 truncate">
                              {o.subLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </Listbox.Option>
                ))
              )}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
