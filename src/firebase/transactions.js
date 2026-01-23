import { addData, updateData, deleteData, subscribeToData, queryData } from './database';
import { removeUndefined } from '../utils/cleanObject';
import { ref, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import { realtimeDb } from './config';

const BACKUP_DATABASE_URL = 'https://back--up-default-rtdb.asia-southeast1.firebasedatabase.app';

const BACKUP_SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "back--up",
  "private_key_id": "b6e066e2bd38a65ea06eb6bffde8fa6bd79153dd",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCM/6OH99IiueQ3\nQ32Zeotdks0kjnmFUwljk2IALQx4eEg96XUp0BCWAYP2Rhhr6nyhfDt6n7b4YS55\nuHLvanciotGkUCyIFeEJuWNj+uJftOOuRSW8RlexVNtHX3ISuFdvrN2p2cUOk4oI\nedg0hp1DCIBCjX8YDUbr4e6r2UpVaXC678VEHGm+cVG1PAg6TFv+tW1FPlJQ7rU4\nL9TZuwuzE/wusXEEUvWXPNK42UJIxeP718KoqEHP+T4p5kLcav4aPemPCrRWhJjq\niWhpdmlTOWqyvGLf7rzOHG2NdoG0Co73IMTy2hHweFKvRBfgdvB+c8Y9j0K+08na\nNtRKjBrPAgMBAAECggEACtpYh4w7SAH//4L55XjpxkuY78Hpt6nzFI+RIQtWpOU5\nRk60foHt7OXz9t5hXdkgO7vYxjEJ/+dXEPZyHlyXC/r1YQzsyJLKjhmPfXAfwZcm\nWVEoPOw7LsKl2EIQAUHgNQ/cxgilouAXZVyfmDduXm0GlljW2g6XkWuEGAUzNAy6\n6WhH6gxwZvbrIAG/jb+T3+OgtREuWwpRMOJdIZ204kmXRdXxMkS6Vn+cL8a0Sy7a\nhb7A7rmDrogL5uhKu6P6Gavm6Vp0xFEK5umDg9VSrWJI/YVe89NRWPROkb4TZivi\nxxNZxEP/McNp23mOsJQRlPaGnTEU5F5WS0MtgjmPpQKBgQC/hnhaGMWbYP8WC6s6\nyVJjzNm0UpCH3L1BMZOuhzuSif/HshCLFl6hnM3/VHgX/LaAbk8LmmhxudxPsEHo\naUPuDA8rqQ5Mq44o18U6fsbMUncigJTgVsggyU4J9M/yRb5ILyCThxhBQvXduzob\nWJ4AKoLX7sbOEIM4KMzRtB+bQwKBgQC8ds9mYdmpx8XpmyjXad1xVS3UECTZsUkQ\nmX+NXiclUxMPZL2RwLDTzUT/7fa+Dn6x5z47nIZiFkdvyMYyAb6pQdGjxoDaHerU\nqKfkD2+efVKXX4fH5hUrKoEfnctR/MjqwEfOlSeEUE4HFrrWB/lO3tV43XO6KG3R\nOZLFy8g7hQKBgAuR3P1cV7ueLWqwg8SGWuLKgjBBeJesfwZML2awpqmgioIOwK8W\nR9stdMhC2wpf6spxX3cM+dg86RErTZ/zk/XyZow1pzZ8epb/CdwRwoKfTLEZ4WR3\n+Zj5cCxrzJAPJIKJzkb7NzziBaZCZC04ujq6VrMiqoHSP4sJ8+2LGwmvAoGAEFkq\nEpKIZB7tPx9zgoQvbmZaLFweJjgnw2XdV7EEKkuzipFNlHgnnqfexWiqD8CIIvyR\nPHCOg7G1DrBW6P2XwWzxN4i/oqwXs8zRi4n/P7tVT8Y8rA18ZpswSkLQ4VLRRvPZ\nBsWPgP3KVvkUyf41FS9lSy/CmzJonE6nObs8qlUCgYBkM9UiZVeaapLJGzJ4TBi4\n9P+3pF0GlhzWSAF7AanWLhq4+2gAtpIiXFxdE/+vuKLcwGiRE7KlH9lPegBBmovH\n3Xbb9TmEMDSJsOD1UKNHWLD2eAudmpV5iUOAC7oYIovm28aGAuU3Jz96a0IR3ARf\n4K0gE0jFhhH2CYY60d0Umw==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@back--up.iam.gserviceaccount.com",
  "client_id": "117754869080216026884",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40back--up.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const backupTransaction = async (uid, id, data) => {
  try {
    const url = `${BACKUP_DATABASE_URL}/users/${uid}/transactions/${id}.json`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      console.error('Backup failed:', response.status);
    }
  } catch (error) {
    console.error('Backup error:', error);
  }
};

export const addTransactionToDB = async (uid, transaction) => {
  const cleaned = removeUndefined(transaction);
  const id = await addData(`users/${uid}/transactions`, cleaned);
  await backupTransaction(uid, id, cleaned);
  return id;
};

export const updateTransactionInDB = async (uid, id, transaction) => {
  const cleaned = removeUndefined(transaction);
  await updateData(`users/${uid}/transactions/${id}`, cleaned);
  await backupTransaction(uid, id, cleaned);
};

export const deleteTransactionFromDB = async (uid, id) => {
  await deleteData(`users/${uid}/transactions/${id}`);
  await backupTransaction(uid, id, null);
};

export const subscribeToTransactions = (uid, callback) =>
  subscribeToData(`users/${uid}/transactions`, callback);

export const fetchTransactionsByDateRange = async (uid, startDate, endDate) => {
  try {
    const transactionsRef = ref(realtimeDb, `users/${uid}/transactions`);
    const transactionsQuery = query(
      transactionsRef,
      orderByChild('date'),
      startAt(startDate.toISOString()),
      endAt(endDate.toISOString())
    );
    
    const snapshot = await get(transactionsQuery);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching transactions by date range:', error);
    throw error;
  }
}; 