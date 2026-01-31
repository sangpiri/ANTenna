import { useState, useMemo } from 'react';

interface CalendarProps {
  availableDates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  minYear: number;
  maxYear: number;
  initialYear: number;
  initialMonth: number;
}

function Calendar({
  availableDates,
  selectedDate,
  onSelectDate,
  minYear,
  maxYear,
  initialYear,
  initialMonth,
}: CalendarProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // 사용 가능한 날짜 Set
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  // 해당 월의 달력 데이터 생성
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];

    // 첫 주 빈칸
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 마지막 주 빈칸
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [year, month]);

  const formatDate = (day: number) => {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const isAvailable = (day: number) => availableDateSet.has(formatDate(day));
  const isSelected = (day: number) => formatDate(day) === selectedDate;

  const prevMonth = () => {
    if (month === 1) {
      if (year > minYear) {
        setYear(year - 1);
        setMonth(12);
      }
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      if (year < maxYear) {
        setYear(year + 1);
        setMonth(1);
      }
    } else {
      setMonth(month + 1);
    }
  };

  const canPrev = year > minYear || month > 1;
  const canNext = year < maxYear || month < 12;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 w-[280px] sm:w-72">
      {/* 년/월 네비게이션 */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <button
          onClick={prevMonth}
          disabled={!canPrev}
          className={`p-1.5 sm:p-2 rounded hover:bg-gray-700 ${!canPrev ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-gray-700 border-none rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm"
          >
            {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-gray-700 border-none rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>

        <button
          onClick={nextMonth}
          disabled={!canNext}
          className={`p-1.5 sm:p-2 rounded hover:bg-gray-700 ${!canNext ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map((name, i) => (
          <div
            key={name}
            className={`text-center text-xs py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* 달력 */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {calendarData.flat().map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="h-7 sm:h-8" />;
          }

          const available = isAvailable(day);
          const selected = isSelected(day);
          const dayOfWeek = idx % 7;

          return (
            <button
              key={idx}
              onClick={() => available && onSelectDate(formatDate(day))}
              disabled={!available}
              className={`
                h-7 sm:h-8 rounded text-xs sm:text-sm transition-colors
                ${selected ? 'bg-blue-600 text-white font-bold' : ''}
                ${available && !selected ? 'hover:bg-gray-700 cursor-pointer' : ''}
                ${!available ? 'text-gray-600 cursor-not-allowed' : ''}
                ${available && !selected && dayOfWeek === 0 ? 'text-red-400' : ''}
                ${available && !selected && dayOfWeek === 6 ? 'text-blue-400' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;
