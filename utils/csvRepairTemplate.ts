export const downloadRepairCSVTemplate = () => {
  // Header dengan spacing yang jelas
  const headers = [
    'mcid',
    'mac_address', 
    'factory',
    'line',
    'date',
    'problem',
    'action',
    'technician_name'
  ];
  
  // Contoh data yang lebih lengkap dan jelas
  const exampleRows = [
    [
      'MCID001',
      'AA:BB:CC:DD:EE:FF',
      'Factory A',
      'Line 1',
      '2024-01-15',
      'Device tidak dapat connect ke server',
      'Reset device dan update firmware ke versi terbaru',
      'John Doe'
    ],
    [
      'MCID002',
      '11:22:33:44:55:66',
      'Factory B',
      'Line 2',
      '2024-01-16',
      'Sensor tidak membaca data dengan akurat',
      'Ganti sensor dan lakukan kalibrasi ulang',
      'Jane Smith'
    ],
    [
      'MCID003',
      'AA:11:BB:22:CC:33',
      'Factory A',
      'Line 3',
      '2024-01-17',
      'Device sering disconnect dari network',
      'Periksa kabel ethernet dan restart device',
      'Bob Johnson'
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
  link.setAttribute('download', 'template-import-repair.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
