"use client";

import * as React from "react";
import { format } from "date-fns";
import { History } from "lucide-react";

import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatePicker({ onChange }: { onChange: (date: Date) => void }) {
  const [date, setDate] = React.useState<Date>();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <History
          color="#ff6600"
          className="cursor-pointer"
          onClick={() => setOpen(true)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(date) => {
            setDate(date);
            onChange(date as Date);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
