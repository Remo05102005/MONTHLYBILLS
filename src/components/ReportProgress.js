import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import PdfIcon from '@mui/icons-material/PictureAsPdf';
import CheckIcon from '@mui/icons-material/Check';

const pulse = keyframes`
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
  70%  { transform: scale(1.06); box-shadow: 0 0 0 16px rgba(37, 99, 235, 0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
`;

/**
 * Shown while the monthly report is being built.
 *
 * progress = { stage: 'fetch' | 'build' | 'done', done, total, label }
 *  - fetch: `done` of `total` months have been loaded, `label` is the month in flight
 *  - build: all data is in, the pages are being drawn
 *  - done:  finished
 */
const ReportProgress = ({ progress }) => {
  const { stage = 'fetch', done = 0, total = 12, label = '' } = progress || {};

  // Loading months fills the first 85% of the bar, drawing pages the rest.
  let percent = 0;
  if (stage === 'fetch') percent = (done / total) * 85;
  else if (stage === 'build') percent = 92;
  else percent = 100;

  let message = '';
  if (stage === 'fetch') message = `Collecting ${label}  (${Math.min(done + 1, total)} of ${total})`;
  else if (stage === 'build') message = 'Drawing your graphs and pages...';
  else message = 'Your report is ready!';

  return (
    <Box sx={{ py: 3, textAlign: 'center' }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          bgcolor: stage === 'done' ? 'success.main' : 'primary.main',
          color: '#fff',
          mx: 'auto',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: stage === 'done' ? 'none' : `${pulse} 1.6s ease-out infinite`,
        }}
      >
        {stage === 'done' ? <CheckIcon sx={{ fontSize: 38 }} /> : <PdfIcon sx={{ fontSize: 36 }} />}
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {stage === 'done' ? 'All done' : 'Building your report'}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.5, minHeight: 22, animation: stage === 'done' ? 'none' : `${blink} 1.8s ease-in-out infinite` }}
      >
        {message}
      </Typography>

      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ mt: 3, height: 10, borderRadius: 5 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
        {Math.round(percent)}%
      </Typography>

      {/* One dot per month: filled once loaded, pulsing while loading */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mt: 2.5, flexWrap: 'wrap' }}>
        {Array.from({ length: total }).map((_, i) => {
          const loaded = stage !== 'fetch' || i < done;
          const loading = stage === 'fetch' && i === done;
          return (
            <Box
              key={i}
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: loaded ? 'success.main' : 'action.disabledBackground',
                border: '2px solid',
                borderColor: loading ? 'primary.main' : 'transparent',
                animation: loading ? `${blink} 0.9s ease-in-out infinite` : 'none',
                transition: 'background-color 0.3s',
              }}
            />
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Looking at the last {total} months
      </Typography>
    </Box>
  );
};

export default ReportProgress;
