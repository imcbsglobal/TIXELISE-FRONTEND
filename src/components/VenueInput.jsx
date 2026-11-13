import { ChevronDown } from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function VenueInput({
  id,
  value,
  onChange,
  venues = [],
  placeholder,
  className,
  disabled = false,
}) {
  const listId = React.useId()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filtered = useMemo(() => {
    const term = String(value || '').trim().toLowerCase()
    if (!term) return venues
    return venues.filter((venue) => venue.toLowerCase().includes(term))
  }, [value, venues])

  function selectVenue(venue) {
    if (!venue) return
    onChange(venue)
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        filtered.length ? Math.min(current + 1, filtered.length - 1) : -1,
      )
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => (filtered.length ? Math.max(current - 1, 0) : -1))
      return
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && filtered[activeIndex]) {
      event.preventDefault()
      selectVenue(filtered[activeIndex])
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => {
          if (venues.length) setOpen(true)
        }}
        onBlur={() => {
          setOpen(false)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        disabled={disabled}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Hide existing venues' : 'Show existing venues'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((current) => !current)
          inputRef.current?.focus()
        }}
        disabled={disabled || venues.length === 0}
        className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && filtered.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Existing venues"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {filtered.map((venue, index) => (
            <button
              key={venue}
              id={`${listId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectVenue(venue)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'flex w-full items-center rounded px-3 py-2 text-left text-[14px] transition-colors',
                index === activeIndex
                  ? 'bg-accent text-[#00794e]'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              {venue}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
