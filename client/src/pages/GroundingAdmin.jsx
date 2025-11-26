import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Upload, FileText, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';

const API_BASE = 'http://localhost:5001/api';

const GroundingAdmin = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMetadata, setUploadMetadata] = useState({
    title: '',
    topics: [],
    bankTypes: [],
    assetSizeRange: 'all'
  });
  const [editingDoc, setEditingDoc] = useState(null);

  // Topic options
  const topicOptions = [
    'liquidity',
    'capital',
    'asset_quality',
    'earnings',
    'risk_management',
    'efficiency',
    'growth',
    'technology',
    'strategy',
    'general'
  ];

  const bankTypeOptions = ['community', 'regional', 'large', 'mega', 'all'];
  const assetSizeOptions = ['<100M', '100M-1B', '1B-10B', '10B-50B', '>50B', 'all'];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await axios.get(`${API_BASE}/grounding/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadMetadata(prev => ({
        ...prev,
        title: file.name.replace('.pdf', '')
      }));
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      formData.append('title', uploadMetadata.title);
      formData.append('topics', JSON.stringify(uploadMetadata.topics));
      formData.append('bankTypes', JSON.stringify(uploadMetadata.bankTypes));
      formData.append('assetSizeRange', uploadMetadata.assetSizeRange);

      const response = await axios.post(`${API_BASE}/grounding/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Upload response:', response.data);

      // Reset form
      setSelectedFile(null);
      setUploadMetadata({
        title: '',
        topics: [],
        bankTypes: [],
        assetSizeRange: 'all'
      });
      document.getElementById('file-upload').value = '';

      // Reload documents
      await loadDocuments();

      alert('Document uploaded! Processing in background...');
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document and all its chunks?')) return;

    try {
      await axios.delete(`${API_BASE}/grounding/documents/${docId}`);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Delete failed: ' + error.message);
    }
  };

  const handleSaveEdit = async (docId) => {
    try {
      await axios.put(`${API_BASE}/grounding/documents/${docId}`, editingDoc);
      setEditingDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error('Error updating:', error);
      alert('Update failed: ' + error.message);
    }
  };

  const toggleTopic = (topic) => {
    setUploadMetadata(prev => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic]
    }));
  };

  const toggleBankType = (type) => {
    setUploadMetadata(prev => ({
      ...prev,
      bankTypes: prev.bankTypes.includes(type)
        ? prev.bankTypes.filter(t => t !== type)
        : [...prev.bankTypes, type]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'processing': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✓';
      case 'processing': return '⏳';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <img src="/claude-icon.svg" alt="Claude AI" className="w-10 h-10" />
          <h1 className="text-4xl font-bold text-foreground">
            Expert Grounding Admin
          </h1>
        </div>
        <p className="text-muted-foreground">
          Manage research documents and agent constitution
        </p>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload New
          </TabsTrigger>
          <TabsTrigger value="constitution">Constitution</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Documents List */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Grounding Documents ({documents.length})</CardTitle>
              <CardDescription>
                Research papers used to ground agent analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents uploaded yet</p>
                  <p className="text-sm mt-2">Upload your first research paper to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map(doc => (
                    <div key={doc._id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{doc.title}</h3>
                            <span className={`text-sm ${getStatusColor(doc.processingStatus)}`}>
                              {getStatusIcon(doc.processingStatus)} {doc.processingStatus}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {doc.filename} • {doc.pageCount || '?'} pages • {doc.chunkCount || 0} chunks
                          </p>

                          {editingDoc?._id === doc._id ? (
                            <div className="space-y-3 bg-muted p-3 rounded">
                              <div>
                                <Label>Title</Label>
                                <Input
                                  value={editingDoc.title}
                                  onChange={e => setEditingDoc({...editingDoc, title: e.target.value})}
                                  className="mt-1"
                                />
                              </div>

                              <div>
                                <Label>Topics</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {topicOptions.map(topic => (
                                    <button
                                      key={topic}
                                      onClick={() => {
                                        const topics = editingDoc.topics.includes(topic)
                                          ? editingDoc.topics.filter(t => t !== topic)
                                          : [...editingDoc.topics, topic];
                                        setEditingDoc({...editingDoc, topics});
                                      }}
                                      className={`px-3 py-1 rounded text-sm ${
                                        editingDoc.topics.includes(topic)
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {topic}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <Label>Bank Types</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {bankTypeOptions.map(type => (
                                    <button
                                      key={type}
                                      onClick={() => {
                                        const bankTypes = editingDoc.bankTypes.includes(type)
                                          ? editingDoc.bankTypes.filter(t => t !== type)
                                          : [...editingDoc.bankTypes, type];
                                        setEditingDoc({...editingDoc, bankTypes});
                                      }}
                                      className={`px-3 py-1 rounded text-sm ${
                                        editingDoc.bankTypes.includes(type)
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      {type}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(doc._id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingDoc(null)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-2 mb-3">
                                {doc.topics?.map(topic => (
                                  <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {topic}
                                  </span>
                                ))}
                                {doc.bankTypes?.map(type => (
                                  <span key={type} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                    {type}
                                  </span>
                                ))}
                              </div>

                              <div className="text-sm text-muted-foreground">
                                Retrieved {doc.timesRetrieved || 0} times
                                {doc.avgReportRating && ` • Avg rating: ${doc.avgReportRating.toFixed(1)}/5`}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingDoc(doc)}
                            disabled={editingDoc?._id === doc._id}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(doc._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {doc.processingError && (
                        <div className="mt-3 p-2 bg-red-50 text-red-800 text-sm rounded">
                          Error: {doc.processingError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Form */}
        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Research Document</CardTitle>
              <CardDescription>
                Upload a PDF research paper about bank financial analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="file-upload">PDF File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={uploadMetadata.title}
                  onChange={e => setUploadMetadata({...uploadMetadata, title: e.target.value})}
                  placeholder="e.g., Bank Analysis Best Practices"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Topics (select all that apply)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {topicOptions.map(topic => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        uploadMetadata.topics.includes(topic)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {topic.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  If none selected, topics will be auto-detected
                </p>
              </div>

              <div>
                <Label>Bank Types (select all that apply)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {bankTypeOptions.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleBankType(type)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        uploadMetadata.bankTypes.includes(type)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use "all" if document applies to all bank sizes
                </p>
              </div>

              <div>
                <Label htmlFor="asset-size">Asset Size Range</Label>
                <select
                  id="asset-size"
                  value={uploadMetadata.assetSizeRange}
                  onChange={e => setUploadMetadata({...uploadMetadata, assetSizeRange: e.target.value})}
                  className="w-full mt-2 px-3 py-2 border rounded-md"
                >
                  {assetSizeOptions.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading & Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>

              <div className="bg-muted p-4 rounded text-sm">
                <p className="font-semibold mb-2">What happens after upload:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>PDF is parsed and text extracted</li>
                  <li>Content is split into 512-token chunks</li>
                  <li>Each chunk is embedded using Voyage AI</li>
                  <li>Embeddings stored in MongoDB for vector search</li>
                  <li>Document becomes available for agent retrieval</li>
                </ol>
                <p className="mt-3 text-xs">
                  Processing happens in the background. Refresh the Documents tab to see status.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Constitution Tab */}
        <TabsContent value="constitution" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Constitution</CardTitle>
              <CardDescription>
                Principles that guide agent analysis (currently hardcoded, feedback learning coming soon)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded">
                  <h3 className="font-semibold mb-3">Current Principles:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Always calculate and verify financial ratios against industry benchmarks</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Flag any unusual patterns in asset quality or lending practices</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Compare metrics to peer institutions of similar size</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Identify both strengths and areas of concern objectively</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Support all conclusions with specific data points</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Highlight regulatory compliance considerations</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Consider macroeconomic context when analyzing trends</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>Reference grounding documents with source citations</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 p-4 rounded text-sm text-blue-900">
                  <p className="font-semibold mb-2">💡 Coming in Phase 2:</p>
                  <p>
                    The feedback system will automatically learn new principles from user corrections
                    and successful analyses. You'll be able to review and approve suggested principles here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{documents.length}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {documents.filter(d => d.processingStatus === 'completed').length} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Chunks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {documents.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Embedded text segments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Retrievals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">
                  {documents.reduce((sum, doc) => sum + (doc.timesRetrieved || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Times used in analysis
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Most Used Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents
                .filter(d => d.timesRetrieved > 0)
                .sort((a, b) => (b.timesRetrieved || 0) - (a.timesRetrieved || 0))
                .slice(0, 5)
                .map(doc => (
                  <div key={doc._id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-muted-foreground">{doc.chunkCount} chunks</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{doc.timesRetrieved} retrievals</p>
                      {doc.avgReportRating && (
                        <p className="text-sm text-muted-foreground">
                          ⭐ {doc.avgReportRating.toFixed(1)}/5
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              {documents.every(d => !d.timesRetrieved || d.timesRetrieved === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No documents have been used yet. Run some agent research to see stats.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GroundingAdmin;
