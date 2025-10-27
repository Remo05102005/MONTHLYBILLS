import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import Avatar from '@mui/material/Avatar';
import SubbaraoChat from '../components/AIAssistant';

const SubbaraoTimeline = () => {
  // Render the assistant in a full page layout for timeline sharing/navigation
  return (
    <Box sx={{ height: '100vh', width: '100vw', bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar */}
      <Box sx={{
        width: '100%',
        maxWidth: 600,
        mx: 'auto',
        px: { xs: 1, sm: 2 },
        pt: 2,
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'white',
        borderRadius: { xs: '0 0 16px 16px', sm: 2 },
        boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
        zIndex: 10
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: '#1976d2', width: 36, height: 36 }}>
            <img src="/logo192.png" alt="Logo" style={{ width: 28, height: 28 }} />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700, ml: 1 }}>Subbarao</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="large" sx={{ color: '#1976d2' }}>
            <HistoryIcon />
          </IconButton>
          <IconButton size="large" sx={{ color: '#1976d2' }} onClick={() => window.history.back()}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      {/* Chat Area */}
      <Box sx={{ flex: 1, overflow: 'auto', width: '100%', maxWidth: 600, mx: 'auto', pb: 10, pt: 1, px: { xs: 1, sm: 2 } }}>
        <SubbaraoChat isOpen={true} onClose={() => { /* handled by route navigation */ }} />
      </Box>
    </Box>
  );
};

export default SubbaraoTimeline;
