import { Repair } from '@/types';
import { format } from 'date-fns';

export const exportRepairsToCSV = (repairs: Repair[]) => {
  // Prepare CSV headers
  const headers = [
    'MCID',
    'MAC Address',
    'Factory',
    'Line',
    'Tanggal',
    'Problem',
    'Action',
    'Teknisi',
    'Status',
    'Created At'
  ];

  // Prepare CSV rows
  const rows = repairs.map((repair) => [
    repair.mcid,
    repair.mac_address,
    repair.factory,
    repair.line,
    format(repair.date, 'yyyy-MM-dd'),
    repair.problem,
    repair.action,
    repair.technician_name,
    repair.status,
    repair.createdAt ? format(repair.createdAt, 'yyyy-MM-dd HH:mm:ss') : ''
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `repair-list-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
