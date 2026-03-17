import { useState, useMemo, useCallback, memo } from 'react';
import type { StockRecord, Market } from '../../types/stock';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (value: any, row: StockRecord, market: Market) => React.ReactNode;
}

interface StockTableProps {
  data: StockRecord[];
  market: Market;
  onRowClick?: (stock: StockRecord) => void;
  selectedCode?: string;
  pageSize?: number;
  columns?: Column[];
}

// 기본 컬럼 정의 (메모이제이션)
const defaultColumnsKr: Column[] = [
  {
    key: '종목코드',
    label: '코드',
    render: (value) => (
      <span className="text-yellow-400 font-mono text-xs sm:text-base leading-tight">
        <span className="sm:hidden block">{value?.slice(0, 3)}<br/>{value?.slice(3)}</span>
        <span className="hidden sm:inline">{value}</span>
      </span>
    ),
  },
  {
    key: '종목명',
    label: '종목명',
    render: (value) => <span className="font-medium">{value}</span>,
  },
  {
    key: '종가',
    label: '종가',
    align: 'right',
    render: (value) => (
      <span className="whitespace-nowrap">{value?.toLocaleString()}</span>
    ),
  },
  {
    key: '전일대비변동률(%)',
    label: '등락률',
    align: 'right',
    render: (value) => {
      const isUp = value > 0;
      const isDown = value < 0;
      return (
        <span className={`font-medium whitespace-nowrap ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : ''}`}>
          {isUp ? '+' : ''}{value?.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: '거래대금',
    label: '거래대금',
    align: 'right',
    render: (value) => {
      let formatted: string;
      if (value >= 1e12) {
        const jo = Math.floor(value / 1e12);
        const eok = Math.floor((value % 1e12) / 1e8);
        formatted = `${jo}조${eok}억`;
      } else {
        formatted = `${(value / 1e8).toFixed(0)}억`;
      }
      return <span className="text-gray-300 whitespace-nowrap">{formatted}</span>;
    },
  },
];

const defaultColumnsUs: Column[] = [
  {
    key: '티커',
    label: '티커',
    width: '100px',
    render: (value) => (
      <span className="text-yellow-400 font-mono text-sm sm:text-base">{value}</span>
    ),
  },
  {
    key: '종목명',
    label: '종목명',
    render: (value) => <span className="font-medium">{value}</span>,
  },
  {
    key: '종가',
    label: '종가',
    align: 'right',
    width: '100px',
    render: (value) => <span>${value?.toFixed(2)}</span>,
  },
  {
    key: '전일대비변동률(%)',
    label: '등락률',
    align: 'right',
    width: '90px',
    render: (value) => {
      const isUp = value > 0;
      const isDown = value < 0;
      return (
        <span className={`font-medium ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : ''}`}>
          {isUp ? '+' : ''}{value?.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: '거래대금',
    label: '거래대금',
    align: 'right',
    width: '100px',
    render: (value) => {
      let formatted: string;
      if (value >= 1e9) {
        formatted = `$${(value / 1e9).toFixed(1)}B`;
      } else if (value >= 1e6) {
        formatted = `$${(value / 1e6).toFixed(1)}M`;
      } else if (value >= 1e3) {
        formatted = `$${(value / 1e3).toFixed(1)}K`;
      } else {
        formatted = `$${value}`;
      }
      return <span className="text-gray-300">{formatted}</span>;
    },
  },
];

// 테이블 행 컴포넌트 (메모이제이션)
const TableRow = memo(function TableRow({
  row,
  idx,
  page,
  pageSize,
  codeKey,
  selectedCode,
  tableColumns,
  market,
  onRowClick,
}: {
  row: StockRecord;
  idx: number;
  page: number;
  pageSize: number;
  codeKey: string;
  selectedCode?: string;
  tableColumns: Column[];
  market: Market;
  onRowClick?: (stock: StockRecord) => void;
}) {
  const code = row[codeKey as keyof StockRecord] as string;
  const isSelected = code === selectedCode;

  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={`
        hover:bg-gray-700/50 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-900/30' : ''}
      `}
    >
      <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-500 text-xs">
        {page * pageSize + idx + 1}
      </td>
      {tableColumns.map((col) => (
        <td
          key={col.key}
          className={`px-1 sm:px-3 py-1.5 sm:py-2 ${
            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
          }`}
        >
          {col.render
            ? col.render(row[col.key as keyof StockRecord], row, market)
            : String(row[col.key as keyof StockRecord] || '')}
        </td>
      ))}
    </tr>
  );
});

function StockTable({
  data,
  market,
  onRowClick,
  selectedCode,
  pageSize = 50,
  columns,
}: StockTableProps) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const tableColumns = useMemo(
    () => columns || (market === 'kr' ? defaultColumnsKr : defaultColumnsUs),
    [columns, market]
  );
  const codeKey = market === 'kr' ? '종목코드' : '티커';

  // 정렬된 데이터
  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof StockRecord];
      const bVal = b[sortKey as keyof StockRecord];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return sortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDir]);

  // 페이지네이션된 데이터
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      // 같은 컬럼 클릭: 3단계 순환 (내림차순 → 오름차순 → 정렬해제)
      if (sortDir === 'desc') {
        setSortDir('asc');
      } else {
        // 오름차순 → 정렬 해제
        setSortKey(null);
        setSortDir('desc');
      }
    } else {
      // 다른 컬럼 클릭: 내림차순으로 시작
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey, sortDir]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(Math.max(0, Math.min(newPage, totalPages - 1)));
  }, [totalPages]);

  return (
    <div className="flex flex-col h-full">
      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-gray-700 sticky top-0 z-10">
            <tr>
              <th className="px-1 sm:px-3 py-1.5 sm:py-2 text-left text-gray-400 text-xs w-6 sm:w-10">#</th>
              {tableColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-1 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-gray-300 cursor-pointer hover:bg-gray-600 transition-colors whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  style={{ width: col.width }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-blue-400">
                        {sortDir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {paginatedData.map((row, idx) => (
              <TableRow
                key={(row[codeKey as keyof StockRecord] as string) || idx}
                row={row}
                idx={idx}
                page={page}
                pageSize={pageSize}
                codeKey={codeKey}
                selectedCode={selectedCode}
                tableColumns={tableColumns}
                market={market}
                onRowClick={onRowClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-gray-800 border-t border-gray-700">
          <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">
            총 {data.length.toLocaleString()}개 중 {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)}
          </span>
          <span className="text-xs text-gray-400 sm:hidden">
            {page + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => handlePageChange(0)}
              disabled={page === 0}
              className="px-1.5 sm:px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              «
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className="px-1.5 sm:px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              ‹
            </button>
            <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm hidden sm:inline">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-1.5 sm:px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              ›
            </button>
            <button
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-1.5 sm:px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(StockTable);
