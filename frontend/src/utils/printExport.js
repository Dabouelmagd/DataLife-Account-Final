// Print and Export Utilities for all modules
import html2pdf from 'html2pdf.js';

// Print function that excludes sidebar
export const printContent = (content, title, isRTL = false) => {
  const printWindow = window.open('', '_blank');
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          padding: 30px; 
          direction: ${isRTL ? 'rtl' : 'ltr'}; 
          background: white;
          color: #1a202c;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding-bottom: 20px; 
          border-bottom: 3px solid #3182ce; 
        }
        .header h1 { 
          margin: 0; 
          color: #1a365d; 
          font-size: 28px; 
          font-weight: 700;
        }
        .header p { 
          margin-top: 8px; 
          color: #4a5568; 
        }
        .info-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
          margin-bottom: 30px; 
        }
        .info-box { 
          padding: 15px; 
          background: #f7fafc; 
          border-radius: 8px; 
          border: 1px solid #e2e8f0;
        }
        .info-box h3 { 
          margin: 0 0 10px 0; 
          color: #2d3748; 
          font-size: 14px;
          border-bottom: 1px solid #e2e8f0; 
          padding-bottom: 8px; 
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px; 
          font-size: 13px;
        }
        th, td { 
          border: 1px solid #e2e8f0; 
          padding: 12px 10px; 
          text-align: ${isRTL ? 'right' : 'left'}; 
        }
        th { 
          background: #edf2f7; 
          font-weight: 600; 
          color: #2d3748;
        }
        tr:nth-child(even) { background: #f7fafc; }
        tr:hover { background: #edf2f7; }
        .totals { 
          width: 300px; 
          margin-${isRTL ? 'right' : 'left'}: auto; 
        }
        .totals td { padding: 10px; }
        .grand-total { 
          font-size: 16px; 
          font-weight: bold; 
          background: #ebf8ff !important; 
          color: #2b6cb0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }
        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          color: white;
        }
        .stat-card.green { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); }
        .stat-card.blue { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); }
        .stat-card.orange { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); }
        .stat-card.red { background: linear-gradient(135deg, #fc8181 0%, #f56565 100%); }
        .stat-card h3 { font-size: 28px; margin-bottom: 5px; }
        .stat-card p { font-size: 12px; opacity: 0.9; }
        .status { 
          display: inline-block; 
          padding: 4px 12px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: 500;
        }
        .status-paid, .status-success { background: #c6f6d5; color: #22543d; }
        .status-pending, .status-warning { background: #fefcbf; color: #744210; }
        .status-cancelled, .status-error { background: #fed7d7; color: #c53030; }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
          text-align: center; 
          color: #718096; 
          font-size: 11px; 
        }
        .footer img { height: 30px; margin-bottom: 10px; }
        @media print { 
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${content}
      <div class="footer">
        <p>DataLife Account ERP System</p>
        <p>${isRTL ? 'تم الطباعة في' : 'Printed on'}: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
};

// Export to PDF function
export const exportToPDF = (content, filename, isRTL = false) => {
  const element = document.createElement('div');
  element.innerHTML = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
      ${content}
      <div style="margin-top: 40px; text-align: center; color: #718096; font-size: 11px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
        <p>DataLife Account ERP System</p>
        <p>${isRTL ? 'تم التصدير في' : 'Exported on'}: ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;
  
  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(element).save();
};

// Export to CSV function with Arabic support
export const exportToCSV = (headers, data, filename, isRTL = false) => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility with Arabic
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Generate table HTML for printing
export const generateTableHTML = (headers, rows, isRTL = false) => {
  return `
    <table>
      <thead>
        <tr>
          ${headers.map(h => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td>${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

// Generate stats cards HTML
export const generateStatsHTML = (stats, isRTL = false) => {
  const colors = ['', 'green', 'blue', 'orange', 'red'];
  return `
    <div class="stats-grid">
      ${stats.map((stat, idx) => `
        <div class="stat-card ${colors[idx % colors.length]}">
          <h3>${stat.value}</h3>
          <p>${stat.label}</p>
        </div>
      `).join('')}
    </div>
  `;
};

export default { printContent, exportToPDF, exportToCSV, generateTableHTML, generateStatsHTML };
