import { fetchTransactionsByDateRange, subscribeToTransactions } from '../firebase/transactions';
import { format } from 'date-fns';

// Helper to compute date ranges for known timeline keywords
function getDateRangeForTimeline(timeline, customStart, customEnd) {
  const now = new Date();
  let start = null;
  let end = null;

  switch (timeline) {
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'last3Months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = now;
      break;
    case 'last6Months':
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      end = now;
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      end = now;
      break;
    case 'custom':
      if (customStart && customEnd) {
        start = customStart;
        end = customEnd;
      }
      break;
    default:
      // If unknown, return last 3 months by default
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = now;
  }

  return { start, end };
}

// Build XML transaction list and return structured context
export async function getUserContextData(uid, options = {}) {
  const { timeline = 'thisMonth', customStartDate = null, customEndDate = null, query = '', userName = '' } = options;
  const { start, end } = getDateRangeForTimeline(timeline, customStartDate, customEndDate);

  let transactionsObj = null;
  try {
    if (start && end) {
      transactionsObj = await fetchTransactionsByDateRange(uid, start, end);
    } else {
      // No date range: try subscribing or fetch nothing (fallback)
      transactionsObj = null;
    }
  } catch (err) {
    console.error('Error fetching transactions for context:', err);
    transactionsObj = null;
  }

  // Convert fetched object to array
  const transactions = transactionsObj ? Object.values(transactionsObj) : [];

  // If query references weekdays like 'Mondays', filter by weekday
  const lowerQuery = (query || '').toLowerCase();
  if (lowerQuery.includes('monday') || lowerQuery.includes('mondays')) {
    const filtered = transactions.filter(t => new Date(t.date).getDay() === 1);
    // Replace array
    // eslint-disable-next-line no-unused-vars
    transactions.splice(0, transactions.length, ...filtered);
  }

  // Build XML transaction list
  const transactionListXml = transactions.map(t => {
    const date = t.date ? format(new Date(t.date), 'yyyy-MM-dd') : '';
    const amount = typeof t.amount === 'number' ? t.amount : Number(t.amount || 0);
    const category = t.category || 'Other';
    const type = t.type || 'expense';
    const desc = (t.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<transaction id="${t.id || ''}" date="${date}" type="${type}" category="${category}" amount="${amount}">${desc}</transaction>`;
  }).join('\n');

  const userXml = `<context>\n  <user name="${userName || ''}" id="${uid}"/>\n  <transactions>\n    ${transactionListXml}\n  </transactions>\n  <query>${(query || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</query>\n</context>`;

  return {
    xml: userXml,
    transactions,
    start,
    end,
  };
}

export default {
  getUserContextData
};
