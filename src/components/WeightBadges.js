import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Tooltip } from '@mui/material';
import { buildBadges } from '../utils/weightAnalytics';

const WeightBadges = ({ journey, measurements }) => {
  const badges = useMemo(() => buildBadges(journey, measurements), [journey, measurements]);
  if (!journey) return null;
  const earned = badges.filter((b) => b.earned).length;

  return (
    <Card sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>🏅 Badges</Typography>
          <Typography variant="body2" color="text.secondary">{earned}/{badges.length} earned</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 1 }}>
          {badges.map((b) => (
            <Tooltip key={b.id} title={b.earned ? 'Earned!' : b.hint}>
              <Box
                sx={{
                  textAlign: 'center', p: 1.25, borderRadius: 2, border: '1px solid',
                  borderColor: b.earned ? 'success.light' : 'divider',
                  bgcolor: b.earned ? 'rgba(76, 175, 80, 0.08)' : 'action.hover',
                  opacity: b.earned ? 1 : 0.55,
                  filter: b.earned ? 'none' : 'grayscale(1)',
                }}
              >
                <Typography sx={{ fontSize: 28, lineHeight: 1.2 }}>{b.icon}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>{b.title}</Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default WeightBadges;
