import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Grid,
  Alert,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const FoodIntakeList = ({ 
  foodIntakeData = [], 
  onEdit, 
  onDelete, 
  onAdd,
  isLoading = false,
  date,
  hideHeader = false
}) => {
  const getUnitLabel = (unit) => {
    const unitMap = {
      'pieces': 'pcs',
      'pack': 'pack',
      'grams': 'g',
      'ml': 'ml'
    };
    return unitMap[unit] || unit;
  };

  const formatTime = (timeString) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      return format(date, 'hh:mm a');
    } catch {
      return timeString;
    }
  };

  const getMealType = (timeString) => {
    try {
      const [hours] = timeString.split(':');
      const hour = parseInt(hours, 10);
      
      if (hour >= 6 && hour < 10) return 'Breakfast';
      if (hour >= 11 && hour < 14) return 'Lunch';
      if (hour >= 17 && hour < 21) return 'Dinner';
      return 'Snack';
    } catch {
      return 'Meal';
    }
  };

  const getMealColor = (mealType) => {
    const colorMap = {
      'Breakfast': 'primary',
      'Lunch': 'secondary',
      'Dinner': 'warning',
      'Snack': 'info'
    };
    return colorMap[mealType] || 'default';
  };

  /**
   * Calculate daily nutrient summary with complete data
   */
  const calculateDailySummary = () => {
    if (!foodIntakeData || foodIntakeData.length === 0) {
      return null;
    }

    const summary = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      cholesterol: 0,
      vitaminA: 0,
      vitaminC: 0,
      calcium: 0,
      iron: 0,
      totalItems: foodIntakeData.length
    };

    foodIntakeData.forEach(entry => {
      if (entry.nutrients) {
        summary.calories += entry.nutrients.calories || 0;
        summary.protein += entry.nutrients.protein || 0;
        summary.carbs += entry.nutrients.carbs || 0;
        summary.fat += entry.nutrients.fat || 0;
        summary.fiber += entry.nutrients.fiber || 0;
        summary.sugar += entry.nutrients.sugar || 0;
        summary.sodium += entry.nutrients.sodium || 0;
        summary.cholesterol += entry.nutrients.cholesterol || 0;
        summary.vitaminA += entry.nutrients.vitaminA || 0;
        summary.vitaminC += entry.nutrients.vitaminC || 0;
        summary.calcium += entry.nutrients.calcium || 0;
        summary.iron += entry.nutrients.iron || 0;
      }
    });

    return summary;
  };

  const dailySummary = calculateDailySummary();

  // State for nutrient view modal
  const [selectedFoodEntry, setSelectedFoodEntry] = useState(null);
  const [isNutrientModalOpen, setIsNutrientModalOpen] = useState(false);

  const handleViewNutrients = (entry) => {
    setSelectedFoodEntry(entry);
    setIsNutrientModalOpen(true);
  };

  const handleCloseNutrientModal = () => {
    setIsNutrientModalOpen(false);
    setSelectedFoodEntry(null);
  };

  return (
    <Box>
      {/* Header with Add Button */}
      {!hideHeader && (
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" fontWeight="bold" color="primary">
              🍽️ Food Intake for {format(new Date(date), 'MMM dd, yyyy')}
            </Typography>
            <Tooltip title="Add Food Entry">
              <IconButton 
                onClick={onAdd}
                color="primary"
                disabled={isLoading}
                sx={{
                  backgroundColor: 'primary.light',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* Enhanced Daily Summary */}
          {dailySummary && (
            <Card sx={{ 
              borderRadius: 3, 
              boxShadow: 2,
              border: '1px solid',
              borderColor: 'divider',
              mb: 2
            }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    📊 Daily Nutrition Summary
                  </Typography>
                  <Chip 
                    label={`${dailySummary.totalItems} items tracked`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                </Box>
                
                <Divider sx={{ mb: 2 }} />
                
                {/* Macronutrients Row */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'primary.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="primary" fontWeight="bold">
                        {dailySummary.calories} kcal
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Calories
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'success.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="success.main" fontWeight="bold">
                        {dailySummary.protein.toFixed(1)}g
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Protein
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'warning.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="warning.main" fontWeight="bold">
                        {dailySummary.carbs.toFixed(1)}g
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Carbs
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'error.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="error.main" fontWeight="bold">
                        {dailySummary.fat.toFixed(1)}g
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fat
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Micronutrients Row */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'info.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="info.main" fontWeight="bold">
                        {dailySummary.fiber.toFixed(1)}g
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fiber
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'secondary.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="secondary.main" fontWeight="bold">
                        {dailySummary.vitaminC.toFixed(1)}mg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vitamin C
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'success.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="success.main" fontWeight="bold">
                        {dailySummary.calcium.toFixed(1)}mg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Calcium
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'warning.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="warning.main" fontWeight="bold">
                        {dailySummary.iron.toFixed(1)}mg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Iron
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Health Indicators Row */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'error.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="error.main" fontWeight="bold">
                        {dailySummary.sugar.toFixed(1)}g
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Sugar
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'warning.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="warning.main" fontWeight="bold">
                        {dailySummary.sodium.toFixed(1)}mg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Sodium
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'error.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="error.main" fontWeight="bold">
                        {dailySummary.cholesterol.toFixed(1)}mg
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Cholesterol
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'info.light', 
                      borderRadius: 2,
                      textAlign: 'center'
                    }}>
                      <Typography variant="h6" color="info.main" fontWeight="bold">
                        {dailySummary.vitaminA.toFixed(1)}IU
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vitamin A
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Food Intake Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Food Item</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="right">Quantity</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Unit</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading state
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="textSecondary">Loading food entries...</Typography>
                </TableCell>
              </TableRow>
            ) : foodIntakeData.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Box py={4}>
                    <Typography color="textSecondary" gutterBottom>
                      No food entries for this date
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Add your first food entry to start tracking
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              // Data rows - simplified without nutrient details
              foodIntakeData.map((entry) => {
                const mealType = getMealType(entry.time);
                const mealColor = getMealColor(mealType);
                
                return (
                  <TableRow 
                    key={entry.id}
                    hover
                    sx={{ 
                      '&:last-child td, &:last-child th': { border: 0 },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {formatTime(entry.time)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {entry.foodItem}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {mealType}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2" color="textSecondary">
                        {entry.quantity}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={getUnitLabel(entry.unit)}
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    </TableCell>
                    
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="View Nutrients">
                          <IconButton 
                            size="small"
                            onClick={() => handleViewNutrients(entry)}
                            disabled={isLoading || !entry.nutrients}
                            sx={{
                              backgroundColor: entry.nutrients ? 'success.light' : 'grey.100',
                              color: entry.nutrients ? 'success.main' : 'grey.400',
                              border: entry.nutrients ? '2px solid' : '1px solid',
                              borderColor: entry.nutrients ? 'success.main' : 'grey.300',
                              '&:hover': {
                                backgroundColor: entry.nutrients ? 'success.main' : 'grey.200',
                                color: entry.nutrients ? 'white' : 'grey.600',
                                transform: entry.nutrients ? 'scale(1.1)' : 'none',
                                boxShadow: entry.nutrients ? 3 : 0
                              },
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              animation: entry.nutrients ? 'pulse 2s infinite' : 'none'
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Edit Entry">
                          <IconButton 
                            size="small"
                            onClick={() => onEdit(entry)}
                            color="primary"
                            disabled={isLoading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete Entry">
                          <IconButton 
                            size="small"
                            onClick={() => onDelete(entry.id)}
                            color="error"
                            disabled={isLoading}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Nutrient View Modal */}
      <Dialog
        open={isNutrientModalOpen}
        onClose={handleCloseNutrientModal}
        maxWidth="md"
        fullWidth
        disableScrollLock={true}
        disableEnforceFocus={true}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            📊 Nutrient Details for {selectedFoodEntry?.foodItem}
          </Box>
          <Chip 
            label={`${selectedFoodEntry?.quantity} ${selectedFoodEntry?.unit}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </DialogTitle>
        <DialogContent>
          {selectedFoodEntry && selectedFoodEntry.nutrients ? (
            <Box sx={{ mt: 2 }}>
              {/* Macronutrients Section */}
              <Accordion 
                sx={{ 
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: '12px 0' }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="macronutrients-content"
                  id="macronutrients-header"
                  sx={{
                    backgroundColor: 'primary.light',
                    borderRadius: 1,
                    '&:hover': { backgroundColor: 'primary.lighter' }
                  }}
                >
                  <Typography variant="subtitle2" color="primary" fontWeight="bold">
                    🍽️ Macronutrients
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'primary.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="primary" fontWeight="bold">
                          {selectedFoodEntry.nutrients.calories} kcal
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Calories
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'success.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="success.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.protein}g
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Protein
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'warning.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="warning.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.carbs}g
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Carbs
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'error.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="error.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.fat}g
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Fat
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Micronutrients Section */}
              <Accordion 
                sx={{ 
                  mb: 2,
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: '12px 0' }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="micronutrients-content"
                  id="micronutrients-header"
                  sx={{
                    backgroundColor: 'success.light',
                    borderRadius: 1,
                    '&:hover': { backgroundColor: 'success.lighter' }
                  }}
                >
                  <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                    🥦 Key Nutrients
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'info.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="info.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.fiber}g
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Fiber
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'secondary.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="secondary.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.vitaminC}mg
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Vitamin C
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'success.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="success.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.calcium}mg
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Calcium
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'warning.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="warning.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.iron}mg
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Iron
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Health Indicators Section */}
              <Accordion 
                sx={{ 
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: '12px 0' }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="health-indicators-content"
                  id="health-indicators-header"
                  sx={{
                    backgroundColor: 'warning.light',
                    borderRadius: 1,
                    '&:hover': { backgroundColor: 'warning.lighter' }
                  }}
                >
                  <Typography variant="subtitle2" color="warning.main" fontWeight="bold">
                    ⚠️ Health Indicators
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'error.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="error.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.sugar}g
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Sugar
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'warning.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="warning.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.sodium}mg
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Sodium
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'error.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="error.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.cholesterol}mg
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Cholesterol
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ 
                        p: 2, 
                        backgroundColor: 'info.light', 
                        borderRadius: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="h6" color="info.main" fontWeight="bold">
                          {selectedFoodEntry.nutrients.vitaminA}IU
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Vitamin A
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography color="textSecondary" gutterBottom>
                No nutrient data available for this food item
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Nutrients are calculated when you save the food entry
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={handleCloseNutrientModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FoodIntakeList;
