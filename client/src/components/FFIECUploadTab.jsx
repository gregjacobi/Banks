import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TerminalIcon from '@mui/icons-material/Terminal';

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
    <Box>
      {/* Upload Section */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          border: dragActive ? '2px dashed #1976d2' : '2px dashed #e0e0e0',
          bgcolor: dragActive ? '#f0f7ff' : 'white',
          transition: 'all 0.3s'
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CloudUploadIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Upload FFIEC Call Report Data
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload a quarterly FFIEC Call Report ZIP file to import data for all banks.
          The system will extract and process the data, updating the database with the latest information.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
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
              variant="outlined"
              component="span"
              startIcon={<CloudUploadIcon />}
              disabled={uploading}
            >
              Choose File
            </Button>
          </label>

          {file && (
            <Chip
              label={`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`}
              onDelete={() => setFile(null)}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!file || uploading}
          sx={{ minWidth: 120 }}
        >
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </Button>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {progress < 100 ? `Uploading: ${progress}%` : 'Processing data...'}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            FFIEC data imported successfully! The database has been updated.
          </Alert>
        )}
      </Paper>

      {/* Terminal Log Section */}
      {logs.length > 0 && (
        <Paper
          sx={{
            p: 2,
            bgcolor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.85rem',
            maxHeight: '500px',
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: '#2d2d2d',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: '#555',
              borderRadius: '4px',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 1, borderBottom: '1px solid #333' }}>
            <TerminalIcon sx={{ mr: 1, color: '#4ec9b0', fontSize: '1.2rem' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                color: '#4ec9b0',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              Import Log
            </Typography>
          </Box>

          {logs.map((log, index) => (
            <Box
              key={index}
              sx={{
                mb: 0.5,
                py: 0.25,
                '&:hover': {
                  bgcolor: '#252525'
                }
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '0.75rem',
                  color: '#808080',
                  mr: 2
                }}
              >
                [{log.timestamp}]
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '0.85rem',
                  color: getLogColor(log.type),
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {log.message}
              </Typography>
            </Box>
          ))}
          <div ref={logEndRef} />
        </Paper>
      )}
    </Box>
  );
}

export default FFIECUploadTab;
