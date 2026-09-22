import React, { useState } from 'react';
import { uploadCSV, type CSVImportResult } from '../api';
import { useToast } from '../context/ToastContext';

interface CsvUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ onClose, onSuccess }) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.toLowerCase().endsWith('.csv')) {
        setError('Please choose a .csv file');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file to upload');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const res = await uploadCSV(file);
      setResult(res);
      toast.success(`Imported ${res.tasks_created} new tasks, updated ${res.tasks_updated} tasks!`);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to upload CSV';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Import Tasks from CSV</h3>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-soft)', fontSize: '0.88rem' }}>
              Add or update tasks using a spreadsheet.{' '}
              <a 
                href="/sample_tasks_projects.csv" 
                download="sample_tasks_projects.csv"
                style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 500 }}
              >
                Download sample CSV
              </a>
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleUpload} style={{ padding: '1.25rem 1.5rem' }}>
          {error && <div className="error-message" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>{error}</div>}

          {result ? (
            <div style={{
              backgroundColor: 'var(--surface-alt)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)' }}>
                ✅ Import Complete!
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-soft)', fontSize: '0.85rem' }}>
                <li>Projects created: <strong>{result.projects_created}</strong></li>
                <li>Tasks created: <strong>{result.tasks_created}</strong></li>
                <li>Tasks updated: <strong>{result.tasks_updated}</strong></li>
              </ul>
              {result.errors.length > 0 && (
                <div style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.82rem' }}>
                  <strong>Notes:</strong> {result.errors.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                Select CSV file
              </label>
              <input
                type="file"
                accept=".csv"
                className="form-control"
                style={{ padding: '0.45rem', fontSize: '0.88rem' }}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            {result ? (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!file || uploading}>
                  {uploading ? 'Uploading...' : 'Upload & Sync'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CsvUploadModal;
