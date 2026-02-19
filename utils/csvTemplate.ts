export const downloadCSVTemplate = () => {
  // Header dengan spacing yang jelas
  const headers = [
    'mcid',
    'mac_address',
    'factory',
    'line'
  ];
  
  // Contoh data yang lebih jelas
  const exampleRows = [
    [
      'MCID001',
      'AA:BB:CC:DD:EE:FF',
      'Factory A',
      'Line 1'
    ],
    [
      'MCID002',
      '11:22:33:44:55:66',
      'Factory B',
      'Line 2'
    ],
    [
      'MCID003',
      'AA:11:BB:22:CC:33',
      'Factory A',
      'Line 3'
    ]
  ];
  
  // Format CSV dengan proper escaping
  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'template-import-device.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
