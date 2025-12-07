import { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader2, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ScanProductModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ScannedProduct {
    name: string;
    stock: number;
    price: number;
    unit: string;
}

export const ScanProductModal = ({ isOpen, onClose }: ScanProductModalProps) => {
    const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
    const [preview, setPreview] = useState<string | null>(null);
    const [scannedItems, setScannedItems] = useState<ScannedProduct[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const processImage = async (base64Image: string) => {
        setStep('processing');
        try {
            const res = await fetch('/api/ocr/scan-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: base64Image }),
            });

            if (!res.ok) throw new Error('OCR Failed');

            const data = await res.json();
            const result = data.result || data;

            // Normalize result
            const items = result.products || [];

            // Map to internal format if needed (API returns name, stock, price, unit directly)
            setScannedItems(items);
            setStep('review');
        } catch (error) {
            console.error(error);
            alert('Gagal memproses gambar. Silakan coba lagi.');
            setStep('upload');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setPreview(base64String);
                processImage(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (items: ScannedProduct[]) => {
            const res = await fetch('/api/products/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(items),
            });
            if (!res.ok) throw new Error('Failed to save products');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            alert('Produk berhasil disimpan!');
            onClose();
            setStep('upload');
            setPreview(null);
            setScannedItems([]);
        },
        onError: (error: any) => {
            alert(`Gagal menyimpan: ${error.message}`);
        }
    });

    const handleDeleteItem = (index: number) => {
        setScannedItems(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Camera size={20} className="text-emerald-600" />
                        Scan Catatan Stok
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Upload size={32} className="text-emerald-600" />
                            </div>
                            <p className="font-medium text-slate-700">Upload Foto Catatan</p>
                            <p className="text-sm text-slate-500 mt-1">Dukung JPG, PNG (Tulisan tangan/cetak)</p>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center h-64">
                            <Loader2 size={48} className="text-emerald-600 animate-spin mb-4" />
                            <p className="font-medium text-slate-700">Sedang Menganalisis Gambar...</p>
                            <p className="text-sm text-slate-500">AI sedang membaca daftar produk Anda</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="flex gap-4 items-start bg-blue-50 p-4 rounded-lg text-blue-800 text-sm">
                                <p>Silakan periksa hasil scan di bawah ini sebelum menyimpan.</p>
                            </div>

                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-3 text-left rounded-l-lg">Nama Produk</th>
                                        <th className="p-3 text-right">Stok</th>
                                        <th className="p-3 text-right">Harga</th>
                                        <th className="p-3 text-left">Unit</th>
                                        <th className="p-3 text-right rounded-r-lg">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {scannedItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3 text-right">{item.stock}</td>
                                            <td className="p-3 text-right">{item.price}</td>
                                            <td className="p-3">{item.unit}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => handleDeleteItem(idx)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {step === 'review' && (
                    <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                        <Button variant="outline" onClick={() => setStep('upload')}>Scan Ulang</Button>
                        <Button
                            onClick={() => saveMutation.mutate(scannedItems)}
                            disabled={saveMutation.isPending || scannedItems.length === 0}
                        >
                            {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Semua Produk'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
