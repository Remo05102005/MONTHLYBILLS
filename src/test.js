import { testPDFGeneration } from './utils/pdfGenerator.js';

console.log('Starting PDF generation test...');
const result = testPDFGeneration();
console.log('Test result:', result ? 'Success' : 'Failed'); 