import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Divider,
  Grid
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';

/**
 * OrganizationalChart Component
 * Displays the bank's organizational structure with board members and executives
 */
function OrganizationalChart({ metadata }) {
  if (!metadata?.orgChart) {
    return null;
  }

  const { orgChart } = metadata;
  const { boardMembers = [], executives = [], source, lastUpdated, notes } = orgChart;

  if (boardMembers.length === 0 && executives.length === 0) {
    return null;
  }

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <BusinessIcon sx={{ color: '#d97757', fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Leadership & Governance
        </Typography>
      </Box>

      {/* Board of Directors */}
      {boardMembers.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              mb: 2,
              color: '#d97757',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            Board of Directors
          </Typography>
          <Grid container spacing={2}>
            {boardMembers.map((member, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    '&:hover': {
                      boxShadow: 2,
                      transition: 'box-shadow 0.3s'
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <PersonIcon sx={{ color: '#d97757', mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          {member.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 0.5 }}
                        >
                          {member.title}
                        </Typography>
                        {member.role && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block' }}
                          >
                            {member.role}
                          </Typography>
                        )}
                        {member.since && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5 }}
                          >
                            Since {member.since}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Executive Leadership */}
      {executives.length > 0 && (
        <Box>
          <Divider sx={{ mb: 3 }} />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              mb: 2,
              color: '#d97757',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            Executive Leadership Team
          </Typography>
          <Grid container spacing={2}>
            {executives.map((exec, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    '&:hover': {
                      boxShadow: 2,
                      transition: 'box-shadow 0.3s'
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <PersonIcon sx={{ color: '#d97757', mt: 0.5 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          {exec.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: '#d97757', fontSize: '0.85rem', fontWeight: 500, mb: 0.5 }}
                        >
                          {exec.title}
                        </Typography>
                        {exec.department && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}
                          >
                            {exec.department}
                          </Typography>
                        )}
                        {exec.bio && (
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.4, mt: 1 }}
                          >
                            {exec.bio}
                          </Typography>
                        )}
                        {exec.since && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5 }}
                          >
                            Since {exec.since}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Metadata Footer */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e0e0e0' }}>
        <Grid container spacing={2}>
          {source && (
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <strong>Source:</strong> {source}
              </Typography>
            </Grid>
          )}
          {lastUpdated && (
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <strong>Last Updated:</strong> {new Date(lastUpdated).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Typography>
            </Grid>
          )}
          {notes && (
            <Grid item xs={12}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                {notes}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Paper>
  );
}

export default OrganizationalChart;
