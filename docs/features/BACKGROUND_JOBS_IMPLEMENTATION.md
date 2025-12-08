# Background Jobs Implementation Guide

## ✅ Server-Side Complete

### Files Created/Modified:
1. **`/server/services/jobTracker.js`** - Job tracking service
2. **`/server/routes/research.js`** - Added background job endpoints

### New Endpoints:
- `GET /api/research/:idrssd/job-status?type=report|podcast` - Check job status
- `POST /api/research/:idrssd/generate-background` - Start report generation
- `POST /api/research/:idrssd/podcast/generate-background` - Start podcast generation

### Features:
- Jobs tracked per bank ID (multi-user safe)
- Jobs continue even if user navigates away
- Automatic cleanup of old jobs (24 hours)

---

## 🔄 Client-Side TODO

### AIResearchTab.jsx Changes Needed:

1. **Add new state variables** (line 26-39):
```javascript
const [progress, setProgress] = useState(0);
const [podcastJobStatus, setPodcastJobStatus] = useState(null);
const [podcastProgress, setPodcastProgress] = useState(0);
const [podcastMessage, setPodcastMessage] = useState('');
```

2. **Add polling useEffects** (after line 44):
```javascript
// Poll for active report job
useEffect(() => {
  let pollInterval;
  if (loading) {
    pollInterval = setInterval(() => pollJobStatus('report'), 2000);
  }
  return () => { if (pollInterval) clearInterval(pollInterval); };
}, [loading, idrssd]);

// Poll for active podcast job
useEffect(() => {
  let pollInterval;
  if (podcastJobStatus === 'running' || podcastJobStatus === 'pending') {
    pollInterval = setInterval(() => pollJobStatus('podcast'), 2000);
  }
  return () => { if (pollInterval) clearInterval(pollInterval); };
}, [podcastJobStatus, idrssd]);
```

3. **Add checkForActiveJobs function** (before generateReport):
```javascript
const checkForActiveJobs = async () => {
  try {
    const reportResponse = await axios.get(`/api/research/${idrssd}/job-status?type=report`);
    if (reportResponse.data.hasJob && (reportResponse.data.job.status === 'running' || reportResponse.data.job.status === 'pending')) {
      setLoading(true);
      setStatusMessage(reportResponse.data.job.message);
      setProgress(reportResponse.data.job.progress);
    }

    const podcastResponse = await axios.get(`/api/research/${idrssd}/job-status?type=podcast`);
    if (podcastResponse.data.hasJob && (podcastResponse.data.job.status === 'running' || podcastResponse.data.job.status === 'pending')) {
      setPodcastJobStatus(podcastResponse.data.job.status);
      setPodcastMessage(podcastResponse.data.job.message);
      setPodcastProgress(podcastResponse.data.job.progress);
    }
  } catch (err) {
    console.error('Error checking for active jobs:', err);
  }
};
```

4. **Add pollJobStatus function**:
```javascript
const pollJobStatus = async (jobType) => {
  try {
    const response = await axios.get(`/api/research/${idrssd}/job-status?type=${jobType}`);
    if (!response.data.hasJob) return;

    const job = response.data.job;

    if (jobType === 'report') {
      setStatusMessage(job.message);
      setProgress(job.progress);

      if (job.status === 'completed') {
        setLoading(false);
        await fetchExistingReport();
      } else if (job.status === 'failed') {
        setLoading(false);
        setError(job.error || 'Report generation failed');
      }
    } else if (jobType === 'podcast') {
      setPodcastMessage(job.message);
      setPodcastProgress(job.progress);
      setPodcastJobStatus(job.status);

      if (job.status === 'completed') {
        await checkForPodcast();
        setPodcastJobStatus('completed');
      } else if (job.status === 'failed') {
        setPodcastJobStatus('failed');
        setError(job.error || 'Podcast generation failed');
      }
    }
  } catch (err) {
    console.error(`Error polling ${jobType} job status:`, err);
  }
};
```

5. **Replace generateReport function** (line 124-180):
```javascript
const generateReport = async () => {
  try {
    setLoading(true);
    setError(null);
    setReport(null);
    setProgress(0);
    setStatusMessage('Starting report generation...');

    await axios.post(`/api/research/${idrssd}/generate-background`);
    // Polling will handle the rest
  } catch (err) {
    console.error('Error starting report generation:', err);
    setError('Failed to start report generation');
    setLoading(false);
  }
};
```

6. **Update the loading UI** (around line 220):
```javascript
{loading && (
  <Box sx={{ mb: 3 }}>
    <LinearProgress variant="determinate" value={progress} />
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      {statusMessage} ({progress}%)
    </Typography>
  </Box>
)}
```

7. **Add podcast status display** (after existing podcast controls):
```javascript
{podcastJobStatus === 'running' && (
  <Box sx={{ mt: 2 }}>
    <LinearProgress variant="determinate" value={podcastProgress} />
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      {podcastMessage} ({podcastProgress}%)
    </Typography>
  </Box>
)}
```

### PodcastGenerator.jsx Changes Needed:

1. **Replace SSE approach with background job**:
```javascript
const handleGenerate = async () => {
  try {
    setGenerating(true);
    setError(null);

    // Start background job
    await axios.post(`/api/research/${idrssd}/podcast/generate-background`, {
      experts: selectedExperts
    });

    // Close modal immediately
    onClose();

    // Parent will poll for status
  } catch (err) {
    setError('Failed to start podcast generation');
    setGenerating(false);
  }
};
```

---

## Testing Checklist:

- [ ] Start report generation, navigate away, come back - see progress
- [ ] Start podcast generation, close dialog, see status on main page
- [ ] Multiple users can generate reports for different banks simultaneously
- [ ] Progress bars update every 2 seconds
- [ ] Completed jobs show results automatically
- [ ] Failed jobs show error messages
- [ ] Reload page during generation - job continues

---

## Benefits:

✅ Jobs run in background even if user closes tab
✅ Status persists across page navigations
✅ Multi-user safe (each bank has own job)
✅ No SSE connection issues
✅ Can close podcast dialog immediately
✅ Progress tracked server-side
