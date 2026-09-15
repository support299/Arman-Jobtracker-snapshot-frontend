import { useRef, useEffect, useState } from "react";
import { useDrop } from "react-dnd";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUsHolidayName } from "@/utils/usHolidays";

const HOURS_START = 6;
const HOURS_END = 24;
const SLOT_HEIGHT = 48;
const TECH_COLUMN_MIN_WIDTH = 120;
const HEADER_HEIGHT = 40;

function formatDayLabel(date) {
  const d = new Date(date);
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

function isToday(date) {
  const d = new Date(date);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function getEventColor(event, eventStyleGetter) {
  const styleResult = eventStyleGetter ? eventStyleGetter(event) : {};
  const style = styleResult?.style || {};
  return style["--event-bg-color"] || style.backgroundColor || "#9ca3ef";
}

function formatInvoiceStatusLabel(status) {
  const raw = String(status || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildEventTitleWithInvoiceStatus(baseTitle, type, invoiceStatusLabel) {
  if (type !== "job" || !invoiceStatusLabel) return baseTitle;
  return `${baseTitle}\nInvoice: ${invoiceStatusLabel}`;
}

function isAllDayOrTimeOff(e) {
  return e?.type === "time_off" || e?.allDay === true;
}

/** [start, end) overlaps calendar day in local time */
function rangeOverlapsDay(evStart, evEndExclusive, dayDate) {
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayNext = new Date(dayStart);
  dayNext.setDate(dayNext.getDate() + 1);
  const s = new Date(evStart);
  const e = new Date(evEndExclusive);
  return s < dayNext && e > dayStart;
}

function EventBlock({ event, style, isMobile, onSelectEvent, onStaffDrop, isAppointment, eventStyleGetter }) {
  const [{ isOver }, drop] = useDrop({
    accept: "staff",
    drop: (item) => {
      if (onStaffDrop && event?.resource && !isAppointment && event?.type !== "time_off") {
        onStaffDrop(event.resource, item.user);
      }
    },
    canDrop: () => !isAppointment && event?.type !== "time_off",
    collect: (monitor) => ({
      isOver: monitor.isOver() && !isAppointment && event?.type !== "time_off",
    }),
  });

  const start = new Date(event.start);
  const end = new Date(event.end);
  const minutesFromTop = (start.getHours() - HOURS_START) * 60 + start.getMinutes();
  const durationMinutes = (end - start) / (60 * 1000);
  const top = (minutesFromTop / 60) * SLOT_HEIGHT;
  const height = Math.max(24, (durationMinutes / 60) * SLOT_HEIGHT);

  const title = event.title || "";
  const displayTitle = isMobile
    ? `${start.getHours() % 12 || 12}${start.getMinutes() ? ":" + String(start.getMinutes()).padStart(2, "0") : ""} ${start.getHours() >= 12 ? "PM" : "AM"}`
    : title;

  const resource = event.resource;
  const isRecurring = resource?.job_type === "recurring";
  const isEstimate = event.type === "estimate";
  const invoiceStatusLabel = event.type === "job" ? formatInvoiceStatusLabel(resource?.invoice_status) : "";
  const bgColor = getEventColor(event, eventStyleGetter || (() => ({})));

  return (
    <div
      ref={drop}
      className={cn(
        "absolute left-0.5 right-0.5 rounded-md cursor-pointer overflow-hidden border-0 outline-none flex items-center px-1.5 py-0.5 transition-all",
        isOver && "ring-2 ring-offset-1 ring-white/80"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: bgColor,
        color: "white",
        fontSize: isMobile ? 10 : 12,
        fontWeight: 500,
        minHeight: 20,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectEvent?.(event);
      }}
      title={buildEventTitleWithInvoiceStatus(title, event.type, invoiceStatusLabel)}
    >
      <span className="truncate flex items-center gap-1 flex-1 min-w-0">
        <span className="truncate">{displayTitle}</span>
        {isRecurring && <span className="flex-shrink-0 text-[10px]">(R)</span>}
        {isEstimate && <span className="flex-shrink-0 text-[10px]">(E)</span>}
        {invoiceStatusLabel && (
          <span className="flex-shrink-0 rounded bg-black/15 px-1 py-0.5 text-[9px] font-semibold leading-none text-white/95">
            {invoiceStatusLabel}
          </span>
        )}
      </span>
    </div>
  );
}

export function DayByTechnicianView({
  date,
  events,
  resources,
  eventStyleGetter,
  onSelectEvent,
  onEventDrop,
  onEventResize,
  onStaffDrop,
  onRemoveAssignee,
  minHour = 6,
  maxHour = 24,
}) {
  const scrollRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  const [nowTop, setNowTop] = useState(null);

  const dayStart = new Date(date);
  dayStart.setHours(minHour, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(maxHour, 0, 0, 0);
  const holidayName = getUsHolidayName(date);

  const allDayStripEvents = events.filter(
    (e) =>
      isAllDayOrTimeOff(e) &&
      e.resourceId != null &&
      e.start &&
      e.end &&
      rangeOverlapsDay(e.start, e.end, date)
  );

  const dayEvents = events.filter((e) => {
    if (isAllDayOrTimeOff(e)) return false;
    const start = new Date(e.start);
    return start >= dayStart && start < dayEnd && e.resourceId != null;
  });

  const totalHeight = (maxHour - minHour) * SLOT_HEIGHT;
  const isSingleColumn = resources.length === 1;
  const showToday = isToday(date);
  const timeColWidth = isMobile ? 42 : 52;
  const techColWidth = isMobile ? Math.max(TECH_COLUMN_MIN_WIDTH, 100) : TECH_COLUMN_MIN_WIDTH;
  const gridTemplateCols = isSingleColumn
    ? `${timeColWidth}px 1fr`
    : `${timeColWidth}px ${resources.map(() => `${techColWidth}px`).join(" ")}`;

  const updateNowPosition = () => {
    if (!showToday) {
      setNowTop(null);
      return;
    }
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    if (hours < minHour || hours >= maxHour) {
      setNowTop(null);
      return;
    }
    const top = (hours - minHour) * SLOT_HEIGHT;
    setNowTop(top);
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    updateNowPosition();
    const interval = setInterval(updateNowPosition, 60000);
    return () => clearInterval(interval);
  }, [date, minHour, maxHour, showToday]);

  useEffect(() => {
    if (!showToday || !scrollRef.current || nowTop == null) return;
    const el = scrollRef.current;
    const scrollToNow = () => {
      const containerHeight = el.clientHeight;
      const scrollTarget = nowTop + HEADER_HEIGHT - containerHeight / 2;
      const clamped = Math.max(0, Math.min(scrollTarget, el.scrollHeight - containerHeight));
      el.scrollTop = clamped;
    };
    const t = requestAnimationFrame ? requestAnimationFrame(scrollToNow) : setTimeout(scrollToNow, 50);
    return () => (requestAnimationFrame ? cancelAnimationFrame(t) : clearTimeout(t));
  }, [showToday, date, nowTop]);

  return (
    <div className="fc-day-by-technician flex flex-col w-full" style={{ minHeight: 320 }}>
      {/* Day label above the grid */}
      <div className="flex-shrink-0 px-1 py-2">
        <h2 className="text-base font-semibold text-foreground" aria-live="polite">
          {formatDayLabel(date)}
          {holidayName ? (
            <span className="ml-2 text-sm font-semibold text-orange-700">· {holidayName}</span>
          ) : null}
        </h2>
      </div>

      {allDayStripEvents.length > 0 && (
        <div
          className="flex-shrink-0 mb-2 border border-border/60 rounded-md bg-muted/30 px-2 py-2"
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplateCols,
            gap: "6px 4px",
            alignItems: "start",
          }}
        >
          <div className="text-[11px] font-semibold text-muted-foreground pt-1 pl-0.5">
            Off
          </div>
          {resources.map((res) => {
            const items = allDayStripEvents.filter(
              (e) => String(e.resourceId) === String(res.id)
            );
            return (
              <div key={`off-${res.id}`} className="flex flex-wrap gap-1 min-h-[28px]">
                {items.map((ev) => {
                  const bg = getEventColor(ev, eventStyleGetter);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className="text-left text-[11px] leading-tight px-2 py-1 rounded-md text-white max-w-full truncate shadow-sm hover:opacity-95 transition-opacity"
                      style={{ backgroundColor: bg }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent?.(ev);
                      }}
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable grid: sticky header row + sticky time column */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto border border-border/50 rounded-md relative"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className={cn("relative", !isSingleColumn && "min-w-max")} style={{ minWidth: isSingleColumn ? "100%" : undefined }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: gridTemplateCols,
            gridTemplateRows: `${HEADER_HEIGHT}px ${totalHeight}px`,
            minWidth: isSingleColumn ? "100%" : undefined,
            width: isSingleColumn ? "100%" : undefined,
          }}
        >
          {/* Row 1: Header cells - same column widths as body */}
          <div
            className="border-r text-xs font-semibold sticky top-0 left-0 z-20 bg-background col-start-1 row-start-1"
            style={{ minHeight: HEADER_HEIGHT }}
          >
            <div className="h-10 flex items-center justify-center">Time</div>
          </div>
          {resources.map((res, i) => (
            <div
              key={res.id}
              className="border-r border-border/50 flex items-center justify-between gap-1 px-2 font-semibold text-sm min-w-0 sticky top-0 z-20 bg-background"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              <span className="flex-1 min-w-0 truncate text-center" title={res.title || res.name}>
                {res.title || res.name}
              </span>
              {onRemoveAssignee && res.id !== "unassigned" && res.id !== "schedule" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAssignee(res.id);
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Remove ${res.title || res.name} from view`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Row 2: Body - time column (sticky left) + tech columns */}
          <div
            className="border-r text-xs font-semibold sticky left-0 z-10 bg-background col-start-1 row-start-2"
            style={{ height: totalHeight }}
          >
            <div className="relative" style={{ height: totalHeight }}>
              {Array.from({ length: maxHour - minHour }, (_, i) => minHour + i).map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1 text-muted-foreground"
                  style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT, lineHeight: `${SLOT_HEIGHT}px` }}
                >
                  {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </div>
              ))}
            </div>
          </div>
          {resources.map((res, i) => {
            const colEvents = dayEvents.filter((e) => String(e.resourceId) === String(res.id));
            return (
              <div
                key={`body-${res.id}`}
                className="border-r border-border/50 bg-background relative overflow-hidden"
                style={{ gridColumn: i + 2, gridRow: 2, height: totalHeight }}
              >
                {Array.from({ length: maxHour - minHour - 1 }, (_, j) => (
                  <div
                    key={j}
                    className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: (j + 1) * SLOT_HEIGHT }}
                  />
                ))}
                {colEvents.map((ev) => (
                  <EventBlock
                    key={ev.id}
                    event={ev}
                    isMobile={isMobile}
                    onSelectEvent={onSelectEvent}
                    onStaffDrop={onStaffDrop}
                    isAppointment={ev.type === "appointment"}
                    eventStyleGetter={eventStyleGetter}
                  />
                ))}
              </div>
            );
          })}

        </div>

          {/* Now line overlay - only when viewing today */}
          {showToday && nowTop != null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center gap-2"
              style={{
                top: HEADER_HEIGHT + nowTop,
                left: timeColWidth,
              }}
              aria-hidden
            >
              <span className="flex-shrink-0 text-[10px] font-semibold text-destructive bg-background border border-destructive/50 px-1.5 py-0.5 rounded">
                Now
              </span>
              <div className="flex-1 min-w-0 h-0.5 bg-destructive/90 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
