"use client";

import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function toISODate(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const DATE_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected: DateRange = { from: parseISODate(from), to: parseISODate(to) };

  function handleSelect(range: DateRange | undefined) {
    if (!range?.from) return;
    const nextFrom = range.from;
    const nextTo = range.to ?? range.from;
    onChange(toISODate(nextFrom), toISODate(nextTo));
    if (range.from && range.to) {
      setOpen(false);
    }
  }

  const label = `${selected.from!.toLocaleDateString("fr-FR", DATE_LABEL_FORMAT)} – ${selected.to!.toLocaleDateString("fr-FR", DATE_LABEL_FORMAT)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 justify-start gap-2 font-normal">
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={fr}
          defaultMonth={selected.from}
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
