import { Fragment, useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DAYS, PERIODS, SCHEDULE, FREE, mergeRow, algiersNow, pickDay, dayLabelL, subjectNameL } from "@/lib/timetable";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function Cell({ subject, compact }: { subject: string; compact?: boolean }) {
  const { lang } = useI18n();
  const free = subject === FREE;
  return (
    <span className={cn(
      "block rounded-md text-center font-medium",
      compact ? "px-1.5 py-1 text-xs" : "px-2 py-2 text-sm",
      free ? "text-muted-foreground border border-dashed" : subject === "إسبانية" ? "bg-primary text-primary-foreground" : "bg-school text-school-foreground",
    )}>{subjectNameL(subject, lang)}</span>
  );
}

export function Timetable() {
  const { t, lang } = useI18n();
  const [sel, setSel] = useState<ReturnType<typeof pickDay> | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const tick = () => { const n = algiersNow(); setSel(pickDay(n.weekday, n.minutes)); };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!sel) return <div className="h-40 rounded-xl bg-school-soft animate-pulse" />;
  const day = DAYS[sel.dayIndex]!;
  const title = sel.mode === "today" ? t("todayTimetable") : sel.mode === "tomorrow" ? t("tomorrowTimetable") : t("nextSundayTimetable");

  return (
    <section className="rounded-xl border-2 border-school/30 bg-school-soft p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold text-lg text-school">
          <CalendarDays className="size-5" /> {title}
          <span className="text-sm font-medium text-muted-foreground">— {dayLabelL(sel.dayIndex, lang)}</span>
        </h2>
        <button onClick={() => setFull((v) => !v)}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-1 rounded-full min-h-10 bg-school px-4 py-1.5 text-sm font-medium text-school-foreground hover:opacity-90">
          {full ? t("closeFullWeek") : t("showFullWeek")}
          <ChevronDown className={cn("size-4 transition", full && "rotate-180")} />
        </button>
      </div>

      <ol className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {PERIODS.map((p, i) => (
          <Fragment key={p.n}>
          {p.n === 5 && (
            <li className="rounded-lg bg-muted p-2 flex flex-col items-center justify-center text-xs text-muted-foreground border border-dashed">
              <span>🍱 {t("lunchBreak")}</span><span dir="ltr">12:00-13:00</span>
            </li>
          )}
          <li className="rounded-lg bg-card p-2 space-y-1.5 border">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{t("periodN", { n: p.n })}</span><span dir="ltr">{p.time}</span>
            </div>
            <Cell subject={SCHEDULE[day][i]!} />
          </li>
          </Fragment>
        ))}
      </ol>

      {full && (
        <div className="space-y-3 sm:hidden">
          {DAYS.map((d, di) => (
            <div key={d} className={cn("rounded-lg border bg-card p-3 space-y-2", d === day && "ring-2 ring-accent")}>
              <h3 className="font-bold">{dayLabelL(di, lang)}</h3>
              <ul className="space-y-1.5">
                {mergeRow(SCHEDULE[d]).map((b) => (
                  <li key={b.start} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
                    <span className="text-xs text-muted-foreground" dir="ltr">{PERIODS[b.start]?.time.split("-")[0]}–{PERIODS[b.start + b.span - 1]?.time.split("-")[1]}</span>
                    <Cell subject={b.subject} compact />
                    {b.span > 1 && <span className="col-start-2 text-[10px] text-muted-foreground">{t("hourShort", { n: b.span })}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {full && (
        <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-school/10">
                <th className="p-2 text-start">{t("dayLabel")}</th>
                {PERIODS.map((p) => (
                  <Fragment key={p.n}>
                    {p.n === 5 && (
                      <th className="p-2 font-medium bg-muted">
                        <div>🍱 {t("lunchBreak")}</div>
                        <div className="text-[10px] text-muted-foreground" dir="ltr">12:00-13:00</div>
                      </th>
                    )}
                    <th className="p-2 font-medium">
                      <div>{t("periodN", { n: p.n })}</div>
                      <div className="text-[10px] text-muted-foreground" dir="ltr">{p.time}</div>
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => (
                <tr key={d} className={cn("border-t", d === day && "bg-accent/20")}>
                  <th className="p-2 text-start font-bold whitespace-nowrap">{dayLabelL(di, lang)}</th>
                  {mergeRow(SCHEDULE[d]).map((b) => (
                    <Fragment key={b.start}>
                      {b.start === 4 && <td className="p-1 bg-muted text-center text-xs text-muted-foreground">{t("rest")}</td>}
                      <td colSpan={b.span} className="p-1">
                        <Cell subject={b.subject} compact />
                        {b.span > 1 && <span className="block text-center text-[10px] text-muted-foreground">{t("hourShort", { n: b.span })}</span>}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
