import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Terminal, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

/**
 * FFIEC Upload Tab Component
 * Allows users to upload FFIEC zip files and displays import progress in a terminal-like log
 */
function FFIECUploadTab() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const logEndRef = useRef(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a ZIP file');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a ZIP file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setLogs([]);
    setProgress(0);

    addLog('Starting FFIEC data upload...', 'info');
    addLog(`File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');

    const formData = new FormData();
    formData.append('ffiecZip', file);

    try {
      const response = await axios.post('/api/ffiec/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
          if (percentCompleted === 100) {
            addLog('Upload complete, processing data...', 'info');
          }
        }
      });

      // Process the logs from the server response
      if (response.data.logs) {
        response.data.logs.forEach(log => {
          addLog(log.message, log.type || 'info');
        });
      }

      addLog('✓ Import completed successfully!', 'success');
      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = err.response?.data?.error || 'Failed to upload and process file';
      addLog(`✗ Error: ${errorMsg}`, 'error');
      setError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'error':
        return '#ff6b6b';
      case 'success':
        return '#51cf66';
      case 'warning':
        return '#ffd43b';
      default:
        return '#a0a0a0';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card
        style={{ backgroundColor: '#2d2d30', borderColor: '#3e3e42' }}
        className={`transition-all duration-300 ${
          dragActive ? 'border-[#d97757] border-2' : 'border'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-[#d97757]" />
            <CardTitle className="text-white">Upload FFIEC Call Report Data</CardTitle>
          </div>
          <CardDescription className="text-[#969696]">
            Upload a quarterly FFIEC Call Report ZIP file to import data for all banks.
            The system will extract and process the data, updating the database with the latest information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="ffiec-file-input"
            />
            <label htmlFor="ffiec-file-input">
              <Button
                variant="outline"
                asChild
                disabled={uploading}
                className="cursor-pointer border-[#3e3e42] text-white hover:bg-[#3e3e42]"
              >
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Choose File
                </span>
              </Button>
            </label>

            {file && (
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium border border-[#d97757] bg-[#d97757]/10 text-[#d97757]">
                <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  onClick={() => setFile(null)}
                  className="ml-1 hover:bg-[#d97757]/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="min-w-[120px] bg-[#d97757] hover:bg-[#d97757]/90 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload & Process'
            )}
          </Button>

          {uploading && (
            <div className="space-y-2">
              {/* Progress bar */}
              <div className="h-2 w-full bg-[#1e1e1e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#d97757] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#969696]">
                {progress < 100 ? `Uploading: ${progress}%` : 'Processing data...'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-600/30 bg-green-600/10 p-4">
              <p className="text-sm text-green-600">
                FFIEC data imported successfully! The database has been updated.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal Log Section */}
      {logs.length > 0 && (
        <div
          className="rounded-md p-4 max-h-[500px] overflow-y-auto"
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.85rem',
            border: '1px solid #3e3e42'
          }}
        >
          {/* Terminal Header */}
          <div className="flex items-center mb-4 pb-2 border-b border-[#333]">
            <Terminal className="mr-2 h-5 w-5" style={{ color: '#4ec9b0' }} />
            <span
              className="font-semibold"
              style={{
                fontFamily: '"Courier New", Courier, monospace',
                color: '#4ec9b0',
                fontSize: '0.9rem'
              }}
            >
              Import Log
            </span>
          </div>

          {/* Log Entries */}
          {logs.map((log, index) => (
            <div
              key={index}
              className="mb-1 py-0.5 hover:bg-[#252525] transition-colors"
            >
              <span
                className="mr-4 text-[#808080]"
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '0.75rem'
                }}
              >
                [{log.timestamp}]
              </span>
              <span
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '0.85rem',
                  color: getLogColor(log.type),
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style jsx>{`
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background-color: #2d2d2d;
        }
        div::-webkit-scrollbar-thumb {
          background-color: #555;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default FFIECUploadTab;
