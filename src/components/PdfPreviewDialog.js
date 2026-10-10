import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Shows a generated jsPDF document before it leaves the app. The user can
 * look at it first and then download it or share it.
 *
 * Props:
 *  - doc: jsPDF instance (null/undefined keeps the dialog closed)
 *  - fileName: file name used for download / share
 *  - title: dialog title, also the share title
 *  - shareText: optional text sent along with the shared file
 *  - onClose: called when the dialog is dismissed
 *  - onDone(message): called after a successful download/share
 *  - onError(message): called if download/share fails
 */
const PdfPreviewDialog = ({ doc, fileName, title = 'Report preview', shareText = '', onClose, onDone, onError }) => {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  // Phones get a full-screen preview so the pages are readable.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Build the blob + object URL whenever a new document arrives, and release
  // it when the preview closes or the document changes.
  useEffect(() => {
    if (!doc) {
      setBlob(null);
      setUrl(null);
      return undefined;
    }
    let objectUrl = null;
    try {
      const pdfBlob = doc.output('blob');
      objectUrl = URL.createObjectURL(pdfBlob);
      setBlob(pdfBlob);
      setUrl(objectUrl);
    } catch (err) {
      console.error('Could not build PDF preview:', err);
      if (onError) onError(`Could not preview report: ${err.message}`);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // onError is intentionally not a dependency: parents pass inline functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const canShareFiles = (() => {
    if (!blob || typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] });
    } catch (e) {
      return false;
    }
  })();

  const handleDownload = () => {
    try {
      doc.save(fileName);
      if (onDone) onDone('Report downloaded successfully!');
    } catch (err) {
      if (onError) onError(`Failed to download report: ${err.message}`);
    }
  };

  const handleShare = async () => {
    if (!blob) return;
    setBusy(true);
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      await navigator.share({ title, text: shareText, files: [file] });
      if (onDone) onDone('Report shared successfully!');
    } catch (err) {
      // The user closing the share sheet is not an error.
      if (err && err.name !== 'AbortError' && onError) {
        onError(`Failed to share report: ${err.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const open = Boolean(doc);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      scroll="paper"
      PaperProps={{ sx: isMobile ? {} : { height: '90vh' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        {title}
        <Typography variant="caption" color="text.secondary" display="block">
          Check the report, then download or share it.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {url ? (
          <Box
            component="iframe"
            title={title}
            src={url}
            sx={{ border: 0, width: '100%', flex: 1, minHeight: 0 }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 1.5,
          pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          '& .MuiButton-root': { minHeight: 44 },
        }}
      >
        <Button onClick={onClose}>Close</Button>
        <Box sx={{ flexGrow: 1 }} />
        {url && (
          // Some phone browsers can't render a PDF inside the dialog, so the
          // preview can always be opened in its own tab.
          <Button startIcon={<OpenInNewIcon />} href={url} target="_blank" rel="noopener noreferrer">
            Open
          </Button>
        )}
        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={handleDownload} disabled={!blob}>
          Download
        </Button>
        {canShareFiles && (
          <Button startIcon={<ShareIcon />} variant="contained" onClick={handleShare} disabled={!blob || busy}>
            Share
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PdfPreviewDialog;
