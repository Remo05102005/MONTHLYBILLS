import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { addTodoToDB, updateTodoInDB, deleteTodoFromDB, subscribeToTodos } from '../firebase/todos';
import { auth } from '../firebase/config';

const initialState = {
  todos: [],
  loading: false,
  error: null,
  filters: {
    search: '',
    priority: 'all',
    category: 'all'
  }
};

export const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (_, { dispatch }) => {
    const uid = auth.currentUser.uid;
    return new Promise((resolve) => {
      subscribeToTodos(uid, (data) => {
        const todos = data ? Object.entries(data).map(([id, t]) => ({ id, ...t })) : [];
        dispatch(setTodos(todos));
        resolve();
      });
    });
  }
);

export const addTodoAsync = createAsyncThunk(
  'todos/addTodoAsync',
  async (todo) => {
    const uid = auth.currentUser.uid;
    await addTodoToDB(uid, todo);
    return todo;
  }
);

export const updateTodoAsync = createAsyncThunk(
  'todos/updateTodoAsync',
  async ({ id, todo }) => {
    const uid = auth.currentUser.uid;
    await updateTodoInDB(uid, id, todo);
    return { id, todo };
  }
);

export const deleteTodoAsync = createAsyncThunk(
  'todos/deleteTodoAsync',
  async (id) => {
    const uid = auth.currentUser.uid;
    await deleteTodoFromDB(uid, id);
    return id;
  }
);

const todoSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    setTodos: (state, action) => {
      state.todos = action.payload;
    },
    resetTodos: (state) => {
      state.todos = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTodos.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(fetchTodos.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { setTodos, resetTodos } = todoSlice.actions;
export default todoSlice.reducer;
