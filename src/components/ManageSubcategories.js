import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Grid,
  Paper,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { saveCustomSubcategory, getCustomSubcategories, deleteCustomSubcategory, checkSubcategoryExists } from '../firebase/customSubcategories';

const expenseCategories = [
  'Milk',
  'Vegetables', 
  'Fruits',
  'Groceries',
  'Chicken',
  'Eggs',
  'Petrol',
  'Bills',
  'Others'
];

const ManageSubcategories = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser } = useAuth();
  
  const [selectedCategory, setSelectedCategory] = useState('Others');
  const [customSubcategories, setCustomSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState('');
  const [newSubcategoryError, setNewSubcategoryError] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');

  // Default subcategories for each category
  const defaultSubcategories = {
    Petrol: ['Bike', 'Scooty', 'Car'],
    Bills: [
      'Phone Bill',
      'Electricity',
      'Toll Gate',
      'Rent',
      'Gas',
      'Cable',
      'Wife',
      'Children',
      'Medical',
      'Fees',
    ],
    Milk: [],
    Vegetables: [],
    Fruits: [],
    Groceries: [],
    Chicken: [],
    Eggs: [],
    Others: [],
  };

  useEffect(() => {
    if (open && currentUser) {
      loadCustomSubcategories();
    }
  }, [open, selectedCategory, currentUser]);

  const loadCustomSubcategories = async () => {
    setLoading(true);
    setError('');
    try {
      const subcats = await getCustomSubcategories(currentUser.uid, selectedCategory);
      setCustomSubcategories(subcats || []);
    } catch (err) {
      console.error('Error loading custom subcategories:', err);
      setError('Failed to load custom subcategories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubcategory = async () => {
    if (!newSubcategory.trim()) {
      setNewSubcategoryError('Please enter a subcategory name');
      return;
    }

    if (!currentUser) {
      setNewSubcategoryError('Please sign in to add custom subcategories');
      return;
    }

    try {
      setLoading(true);
      setNewSubcategoryError('');
      
      // Check if subcategory already exists
      const exists = await checkSubcategoryExists(currentUser.uid, selectedCategory, newSubcategory.trim());
      
      if (exists) {
        setNewSubcategoryError('This subcategory already exists');
        setLoading(false);
        return;
      }

      // Save the custom subcategory
      await saveCustomSubcategory(currentUser.uid, selectedCategory, newSubcategory.trim());
      
      // Add to local state
      const newSubcat = {
        name: newSubcategory.trim(),
        createdAt: new Date().toISOString()
      };
      setCustomSubcategories(prev => [...prev, newSubcat]);
      
      // Reset form
      setNewSubcategory('');
      setShowAddForm(false);
      setSuccess('Custom subcategory added successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding custom subcategory:', err);
      setNewSubcategoryError('Failed to add subcategory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubcategory = async (oldName, newName) => {
    if (!newName.trim()) {
      setEditError('Please enter a subcategory name');
      return;
    }

    if (!currentUser) {
      setEditError('Please sign in to edit custom subcategories');
      return;
    }

    try {
      setLoading(true);
      setEditError('');
      
      // Check if the new name already exists (excluding the current subcategory)
      const exists = await checkSubcategoryExists(currentUser.uid, selectedCategory, newName.trim());
      
      if (exists && newName.trim().toLowerCase() !== oldName.toLowerCase()) {
        setEditError('A subcategory with this name already exists');
        setLoading(false);
        return;
      }

      // Delete the old subcategory
      await deleteCustomSubcategory(currentUser.uid, selectedCategory, oldName);
      
      // Save the new subcategory
      await saveCustomSubcategory(currentUser.uid, selectedCategory, newName.trim());
      
      // Update local state
      setCustomSubcategories(prev => 
        prev.map(subcat => 
          subcat.name === oldName 
            ? { ...subcat, name: newName.trim() }
            : subcat
        )
      );
      
      // Reset edit state
      setEditingSubcategory(null);
      setEditValue('');
      setSuccess('Custom subcategory updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error editing custom subcategory:', err);
      setEditError('Failed to update subcategory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubcategory = async (subcategoryName) => {
    if (!currentUser) {
      setError('Please sign in to delete custom subcategories');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Delete the subcategory
      await deleteCustomSubcategory(currentUser.uid, selectedCategory, subcategoryName);
      
      // Update local state
      setCustomSubcategories(prev => prev.filter(subcat => subcat.name !== subcategoryName));
      
      setSuccess('Custom subcategory deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting custom subcategory:', err);
      setError('Failed to delete subcategory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDisplaySubcategories = () => {
    const defaults = defaultSubcategories[selectedCategory] || [];
    return [
      ...defaults.map(name => ({ name, type: 'default' })),
      ...customSubcategories.map(subcat => ({ 
        name: typeof subcat === 'string' ? subcat : (subcat.name || subcat),
        type: 'custom',
        createdAt: subcat.createdAt 
      }))
    ];
  };

  const displaySubcategories = getDisplaySubcategories();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: isMobile ? '90vh' : '80vh',
          margin: isMobile ? 2 : 4,
          overflowY: 'auto',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Manage Subcategories
        </Typography>
        <IconButton 
          edge="end" 
          color="inherit" 
          onClick={onClose} 
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Category Selection */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setShowAddForm(false);
                setNewSubcategory('');
                setNewSubcategoryError('');
              }}
            >
              {expenseCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>


        {/* Add New Subcategory */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setShowAddForm(true);
              setNewSubcategory('');
              setNewSubcategoryError('');
            }}
            disabled={loading}
            sx={{ 
              fontWeight: 'bold',
              textTransform: 'none',
              px: 3,
              py: 1
            }}
          >
            Add Custom Subcategory
          </Button>
        </Box>

        {/* Add Form */}
        {showAddForm && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Add New Custom Subcategory
            </Typography>
            <TextField
              fullWidth
              label="Subcategory Name"
              value={newSubcategory}
              onChange={(e) => {
                setNewSubcategory(e.target.value);
                setNewSubcategoryError('');
              }}
              error={!!newSubcategoryError}
              helperText={newSubcategoryError}
              placeholder={`e.g., ${selectedCategory === 'Petrol' ? 'Diesel' : selectedCategory === 'Bills' ? 'Internet' : 'Custom Item'}`}
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setShowAddForm(false);
                  setNewSubcategory('');
                  setNewSubcategoryError('');
                }}
                startIcon={<CancelIcon />}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddSubcategory}
                disabled={loading || !newSubcategory.trim()}
                startIcon={<SaveIcon />}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Paper>
        )}

        {/* Subcategories List */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Subcategories for "{selectedCategory}"
          </Typography>
          
          {displaySubcategories.length === 0 ? (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
              No subcategories found for this category.
            </Typography>
          ) : (
            <Grid container spacing={1}>
              {displaySubcategories.map((subcat, index) => (
                <Grid item xs={12} sm={6} md={4} key={`${subcat.name}-${index}`}>
                  <Paper
                    sx={{
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid',
                      borderColor: subcat.type === 'custom' ? 'primary.main' : 'divider',
                      bgcolor: subcat.type === 'custom' ? 'transparent' : 'background.paper',
                      borderRadius: 1,
                      minHeight: 48,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: subcat.type === 'custom' ? 2 : 1,
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={subcat.type === 'custom' ? 'Custom' : 'Default'}
                        size="small"
                        color={subcat.type === 'custom' ? 'primary' : 'default'}
                        variant={subcat.type === 'custom' ? 'outlined' : 'filled'}
                        sx={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 'bold',
                          ...(subcat.type === 'custom' && {
                            borderColor: 'primary.main',
                            backgroundColor: 'transparent',
                            color: 'primary.main',
                          })
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: subcat.type === 'custom' ? 'primary.main' : 'text.primary' }}>
                        {subcat.name}
                      </Typography>
                    </Box>
                    
                    {subcat.type === 'custom' && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setEditingSubcategory(subcat.name);
                            setEditValue(subcat.name);
                            setEditError('');
                          }}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteSubcategory(subcat.name)}
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Paper>
                  
                  {/* Edit Form */}
                  {editingSubcategory === subcat.name && (
                    <Paper sx={{ p: 1.5, mt: 1, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <TextField
                        fullWidth
                        label="Edit Subcategory Name"
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          setEditError('');
                        }}
                        error={!!editError}
                        helperText={editError}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          variant="outlined"
                          color="inherit"
                          onClick={() => {
                            setEditingSubcategory(null);
                            setEditValue('');
                            setEditError('');
                          }}
                          startIcon={<CancelIcon />}
                          disabled={loading}
                          size="small"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleEditSubcategory(subcat.name, editValue)}
                          disabled={loading || !editValue.trim()}
                          startIcon={<SaveIcon />}
                          size="small"
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </Button>
                      </Box>
                    </Paper>
                  )}
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
        <Button 
          onClick={onClose} 
          color="inherit" 
          variant="outlined" 
          size="small" 
          sx={{ textTransform: 'none' }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManageSubcategories;