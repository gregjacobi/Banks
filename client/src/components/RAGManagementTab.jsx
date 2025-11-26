import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Description as DescriptionIcon,
  CloudQueue as CloudIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import axios from 'axios';

const RAGManagementTab = ({ selectedBank }) => {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedBank]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load documents - filtered by bank
      const docsRes = await axios.get('/api/grounding/documents', {
        params: selectedBank?.idrssd ? { idrssd: selectedBank.idrssd } : {}
      });
      setDocuments(docsRes.data.documents || []);

      // Load stats - filtered by bank
      const statsRes = await axios.get('/api/grounding/stats', {
        params: selectedBank?.idrssd ? { idrssd: selectedBank.idrssd } : {}
      });
      setStats(statsRes.data);

    } catch (err) {
      setError(err.message);
      console.error('Error loading RAG data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (doc) => {
    // Open PDF in new window using the grounding API endpoint
    if (doc._id) {
      window.open(`/api/grounding/documents/${doc._id}/view`, '_blank');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document from RAG? This will remove all associated chunks.')) {
      return;
    }

    try {
      await axios.delete(`/api/grounding/documents/${docId}`);
      await loadData();
    } catch (err) {
      alert(`Error deleting document: ${err.message}`);
    }
  };

  const handleReprocess = async (docId) => {
    if (!window.confirm('Reprocess this document? This will re-chunk and re-embed the content.')) {
      return;
    }

    try {
      await axios.post(`/api/grounding/documents/${docId}/reprocess`);
      await loadData();
    } catch (err) {
      alert(`Error reprocessing document: ${err.message}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    try {
      setSearching(true);
      const res = await axios.post('/api/grounding/search', {
        query: searchQuery,
        limit: 10,
        ...(selectedBank?.idrssd && { idrssd: selectedBank.idrssd })
      });
      setSearchResults(res.data);
    } catch (err) {
      alert(`Search error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleWipeAll = async () => {
    try {
      const res = await axios.delete('/api/grounding/wipe');
      setWipeDialogOpen(false);
      alert(`Successfully wiped RAG:\n• ${res.data.deleted.documents} documents\n• ${res.data.deleted.chunks} chunks`);
      await loadData();
    } catch (err) {
      alert(`Error wiping RAG: ${err.message}`);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, bgcolor: '#1e1e1e' }}>
        <CircularProgress sx={{ color: '#d97757' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 600, mb: 1 }}>
        RAG Management
      </Typography>
      <Typography variant="body2" sx={{ color: '#858585', mb: 3 }}>
        {selectedBank?.name ? `Managing RAG for ${selectedBank.name}` : 'Manage your Retrieval-Augmented Generation infrastructure'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, bgcolor: '#2d2d30', border: '1px solid #f14c4c', color: '#f14c4c' }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: '#4ec9b0', fontWeight: 600 }}>
                    {documents.length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585' }}>
                    Documents
                  </Typography>
                </Box>
                <DescriptionIcon sx={{ fontSize: 40, color: '#d97757' }} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: '#4fc1ff', fontWeight: 600 }}>
                    {stats.chunks.total}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585' }}>
                    Total Chunks
                  </Typography>
                </Box>
                <CloudIcon sx={{ fontSize: 40, color: '#d97757' }} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: '#ce9178', fontWeight: 600 }}>
                    {formatBytes(stats.documents.totalSize)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585' }}>
                    Storage Used
                  </Typography>
                </Box>
                <StorageIcon sx={{ fontSize: 40, color: '#d97757' }} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: '#89d185', fontWeight: 600 }}>
                    {stats.chunks.totalRetrievals || 0}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585' }}>
                    Total Retrievals
                  </Typography>
                </Box>
                <SearchIcon sx={{ fontSize: 40, color: '#d97757' }} />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Search Interface */}
      <Paper sx={{ mb: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 3 }}>
        <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
          Query Documents
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            placeholder="Enter your question or search query..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            disabled={searching}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#cccccc',
                '& fieldset': { borderColor: '#3e3e42' },
                '&:hover fieldset': { borderColor: '#d97757' },
                '&.Mui-focused fieldset': { borderColor: '#d97757' }
              },
              '& .MuiInputBase-input::placeholder': { color: '#858585', opacity: 1 }
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            startIcon={searching ? <CircularProgress size={20} /> : <SearchIcon />}
            sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
          >
            Search
          </Button>
        </Box>

        {searchResults && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#858585', mb: 1 }}>
              Found {searchResults.results.length} relevant chunks:
            </Typography>
            {searchResults.results.map((result, idx) => (
              <Paper key={idx} sx={{ p: 2, mb: 1, bgcolor: '#1e1e1e', border: '1px solid #3e3e42' }}>
                <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
                  {result.content}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    size="small"
                    label={result.documentTitle}
                    sx={{ bgcolor: '#3e3e42', color: '#cccccc', fontSize: '11px' }}
                  />
                  <Chip
                    size="small"
                    label={`Page ${result.pageNumber}`}
                    sx={{ bgcolor: '#3e3e42', color: '#cccccc', fontSize: '11px' }}
                  />
                  <Chip
                    size="small"
                    label={`Score: ${result.score?.toFixed(3)}`}
                    sx={{ bgcolor: '#d97757', color: 'white', fontSize: '11px' }}
                  />
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      {/* Documents List */}
      <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#ffffff' }}>
            Documents ({documents.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{
                color: '#cccccc',
                borderColor: '#3e3e42',
                '&:hover': { borderColor: '#d97757', color: '#d97757' }
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<WarningIcon />}
              onClick={() => setWipeDialogOpen(true)}
              sx={{
                borderColor: '#3e3e42',
                '&:hover': { borderColor: '#f48771' }
              }}
            >
              Wipe All
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#1e1e1e' }}>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Title</TableCell>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Size</TableCell>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Chunks</TableCell>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Status</TableCell>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Topics</TableCell>
                <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Uploaded</TableCell>
                <TableCell align="right" sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ borderBottom: '1px solid #3e3e42' }}>
                    <Typography sx={{ color: '#858585' }}>No documents in RAG for this bank</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow
                    key={doc._id}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(217, 119, 87, 0.05)' },
                      borderBottom: '1px solid #3e3e42'
                    }}
                  >
                    <TableCell sx={{ borderBottom: '1px solid #3e3e42' }}>
                      <Box
                        onClick={() => handleViewDocument(doc)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                          color: '#4fc1ff',
                          '&:hover': { color: '#d97757' }
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: '13px' }}>
                          {doc.title || doc.filename}
                        </Typography>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#858585', fontSize: '12px', borderBottom: '1px solid #3e3e42' }}>
                      {formatBytes(doc.fileSize || 0)}
                    </TableCell>
                    <TableCell sx={{ color: '#858585', fontSize: '12px', borderBottom: '1px solid #3e3e42' }}>
                      {doc.chunkCount || 0}
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid #3e3e42' }}>
                      <Chip
                        size="small"
                        label={doc.processingStatus}
                        sx={{
                          bgcolor: doc.processingStatus === 'completed' ? '#89d185' :
                                   doc.processingStatus === 'processing' ? '#f48771' :
                                   doc.processingStatus === 'failed' ? '#f14c4c' : '#3e3e42',
                          color: 'white',
                          fontSize: '11px',
                          height: 20
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid #3e3e42' }}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(doc.topics || []).slice(0, 2).map((topic, idx) => (
                          <Chip
                            key={idx}
                            size="small"
                            label={topic}
                            sx={{ bgcolor: '#3e3e42', color: '#cccccc', fontSize: '10px', height: 18 }}
                          />
                        ))}
                        {doc.topics?.length > 2 && (
                          <Typography variant="caption" sx={{ color: '#858585', fontSize: '10px' }}>
                            +{doc.topics.length - 2}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#858585', fontSize: '12px', borderBottom: '1px solid #3e3e42' }}>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: '1px solid #3e3e42' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleReprocess(doc._id)}
                        title="Reprocess"
                        sx={{ color: '#858585', '&:hover': { color: '#d97757' } }}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(doc._id)}
                        title="Delete"
                        sx={{ color: '#858585', '&:hover': { color: '#f48771' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Wipe Confirmation Dialog */}
      <Dialog
        open={wipeDialogOpen}
        onClose={() => setWipeDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#2d2d30',
            border: '1px solid #3e3e42'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', borderBottom: '1px solid #3e3e42' }}>
          Wipe RAG for {selectedBank?.name || 'All Banks'}?
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert
            severity="warning"
            sx={{
              mb: 2,
              bgcolor: 'rgba(244, 135, 113, 0.1)',
              border: '1px solid #f48771',
              color: '#f48771',
              '& .MuiAlert-icon': { color: '#f48771' }
            }}
          >
            This will permanently delete {selectedBank?.idrssd ? 'all documents for this bank' : 'ALL documents'} from RAG. This action cannot be undone!
          </Alert>
          <Typography variant="body2" sx={{ color: '#cccccc', mb: 1 }}>
            You are about to delete:
          </Typography>
          <Box component="ul" sx={{ color: '#858585', fontSize: '14px', pl: 3 }}>
            <li>{documents.length} document{documents.length !== 1 ? 's' : ''}</li>
            <li>{stats?.chunks.total || 0} chunk{stats?.chunks.total !== 1 ? 's' : ''}</li>
            <li>{formatBytes(stats?.documents.totalSize || 0)} of storage</li>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #3e3e42', p: 2 }}>
          <Button
            onClick={() => setWipeDialogOpen(false)}
            sx={{
              color: '#cccccc',
              '&:hover': { bgcolor: 'rgba(217, 119, 87, 0.1)' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWipeAll}
            variant="contained"
            sx={{
              bgcolor: '#f48771',
              '&:hover': { bgcolor: '#f14c4c' }
            }}
          >
            Wipe All Data
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RAGManagementTab;
