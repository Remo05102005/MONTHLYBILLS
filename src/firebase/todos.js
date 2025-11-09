import { addData, updateData, deleteData, subscribeToData } from './database';
import { removeUndefined } from '../utils/cleanObject';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { realtimeDb } from './config';

export const addTodoToDB = (uid, todo) =>
  addData(`users/${uid}/todos`, removeUndefined(todo));

export const updateTodoInDB = (uid, id, todo) =>
  updateData(`users/${uid}/todos/${id}`, removeUndefined(todo));

export const deleteTodoFromDB = (uid, id) =>
  deleteData(`users/${uid}/todos/${id}`);

export const subscribeToTodos = (uid, callback) =>
  subscribeToData(`users/${uid}/todos`, callback);

export const fetchTodosByStatus = async (uid, completed) => {
  try {
    const todosRef = ref(realtimeDb, `users/${uid}/todos`);
    const todosQuery = query(
      todosRef,
      orderByChild('completed'),
      ...(completed !== undefined ? [equalTo(completed)] : [])
    );

    const snapshot = await get(todosQuery);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching todos by status:', error);
    throw error;
  }
};
