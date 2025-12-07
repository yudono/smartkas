import { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Download, AlertTriangle, FileText } from 'lucide-react';
import { Button } from './Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

interface ImportExcelModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateUrl?: string;
    importUrl?: string; // Optional, defaults to /api/products/bulk for backward compatibility if not provided
    mode?: 'client' | 'server'; // 'client' parses JSON, 'server' sends FormData
    queryKey?: string[]; // Query key to invalidate
}

export const ImportExcelModal = ({ 
    isOpen, 
    onClose, 
    templateUrl, 
    importUrl = '/api/products/bulk', 
    mode = 'client',
    queryKey = ['products']
}: ImportExcelModalProps) => {
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSelectedFile(file);

        if (mode === 'client') {
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Basic validation
                if (jsonData.length === 0) {
                    setError("File Excel kosong.");
                    return;
                }

                // Normalize keys to lowercase to be forgiving
                const normalizedData = jsonData.map((row: any) => {
                    const newRow: any = {};
                    Object.keys(row).forEach(key => {
                        newRow[key.toLowerCase()] = row[key];
                    });
                    return {
                        name: newRow.name || newRow.nama || newRow.product || 'Unknown',
                        stock: Number(newRow.stock || newRow.stok || newRow.qty || 0),
                        price: Number(newRow.price || newRow.harga || 0),
                        unit: newRow.unit || newRow.satuan || 'pcs'
                    };
                });

                setPreviewData(normalizedData);

            } catch (err) {
                console.error(err);
                setError("Gagal membaca file Excel. Pastikan format benar.");
            }
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (mode === 'client') {
                const res = await fetch(importUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(previewData),
                });
                if (!res.ok) throw new Error('Failed to import data');
                return res.json();
            } else {
                if (!selectedFile) throw new Error("No file selected");
                const formData = new FormData();
                formData.append('file', selectedFile);
                
                const res = await fetch(importUrl, {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to upload file');
                return data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey });
            
            if (mode === 'server') {
                 alert(`Sukses! ${data.successCount || 'Data'} berhasil diimpor.`);
                 if (data.errors && data.errors.length > 0) {
                    alert(`Peringatan: ${data.errors.length} baris gagal:\n${data.errors.join('\n')}`);
                 }
            } else {
                alert('Import berhasil!');
            }

            handleClose();
        },
        onError: (error: any) => {
            alert(`Gagal import: ${error.message}`);
        }
    });

    const handleClose = () => {
        setPreviewData([]);
        setSelectedFile(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-green-600" />
                        Import Excel
                    </h3>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Template Download Section */}
                    {templateUrl && !previewData.length && !selectedFile && (
                         <div className="mb-6 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <p className="text-sm text-emerald-800 mb-2 font-medium">
                                1. Download template Excel terlebih dahulu:
                            </p>
                            <a 
                                href={templateUrl}
                                className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm font-bold flex items-center gap-2"
                            >
                                <Download size={16} /> Download Template
                            </a>
                        </div>
                    )}

                    {(!previewData.length && !selectedFile) ? (
                        <div className="space-y-6">
                            {/* Upload Section */}
                             <div>
                                <p className="text-sm text-slate-600 mb-2 font-medium">
                                    {templateUrl ? '2. Upload file Excel yang sudah diisi:' : 'Upload file Excel:'}
                                </p>
                                <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}>
                                    <input ref={fileInputRef} type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                        <Upload size={32} className="text-green-600" />
                                    </div>
                                    <p className="font-medium text-slate-700">Klik untuk upload file</p>
                                    <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv</p>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                                    <AlertTriangle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                             {/* Preview or File Selected State */}
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-700">
                                    {mode === 'client' ? `Preview Data (${previewData.length} baris)` : 'File Terpilih'}
                                </h4>
                                <button onClick={() => { setPreviewData([]); setSelectedFile(null); }} className="text-sm text-red-500 hover:underline">Reset</button>
                            </div>

                            {mode === 'client' ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 text-slate-600">
                                            <tr>
                                                <th className="p-2 text-left">Nama</th>
                                                <th className="p-2 text-right">Stok</th>
                                                <th className="p-2 text-right">Harga</th>
                                                <th className="p-2 text-left">Unit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.slice(0, 10).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="p-2">{row.name}</td>
                                                    <td className="p-2 text-right">{row.stock}</td>
                                                    <td className="p-2 text-right">{row.price}</td>
                                                    <td className="p-2">{row.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {previewData.length > 10 && (
                                        <div className="p-2 text-center text-xs text-slate-500 bg-slate-50">
                                            ...dan {previewData.length - 10} baris lainnya
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <FileText className="text-emerald-600" size={24} />
                                    <div>
                                        <p className="font-medium text-slate-800">{selectedFile?.name}</p>
                                        <p className="text-xs text-slate-500">{(selectedFile?.size ? (selectedFile.size / 1024).toFixed(2) : 0)} KB</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {(previewData.length > 0 || selectedFile) && (
                    <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                        <Button variant="outline" onClick={handleClose}>Batal</Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? 'Mengimport...' : 'Import Sekarang'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
