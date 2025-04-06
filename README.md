# COMMON MAN - Personal Finance Tracker

A mobile-first responsive web application for tracking personal income and expenditures. Built with the MERN stack (MongoDB, Express.js, React, Node.js) and Material-UI.

## Features

- Track income and expenses with detailed categorization
- View daily transaction logs with calendar integration
- Sort and filter transactions
- Generate monthly reports and insights
- Mobile-responsive design with native app-like experience
- Clean and intuitive user interface

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/common-man.git
cd common-man
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
common-man/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── store/         # Redux store and slices
│   ├── utils/         # Utility functions
│   ├── context/       # React context providers
│   └── assets/        # Static assets
├── public/            # Public assets
└── package.json       # Project dependencies
```

## Usage

1. **Adding Transactions**
   - Click the "+" button to add a new transaction
   - Select transaction type (Income/Expense)
   - Choose category and subcategory
   - Enter amount and optional description
   - Select date

2. **Viewing Transactions**
   - Home page shows summary cards and statistics
   - Expenditure page lists all expenses with sorting options
   - Daily Logs page shows transactions for selected date

3. **Reports and Insights**
   - Download monthly reports in PDF format
   - View category-wise expense insights
   - Track income vs expenditure trends

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Material-UI for the component library
- Redux Toolkit for state management
- React Router for navigation
- Recharts for data visualization 