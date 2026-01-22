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
  },
  unsubscribe: null
};

export const fetchTodos = createAsyncThunk(
  'todos/fetchTodos',
  async (_, { dispatch, getState }) => {
    const uid = auth.currentUser.uid;
    const state = getState();

    // Clean up existing subscription
    if (state.todos.unsubscribe) {
      state.todos.unsubscribe();
    }

    return new Promise((resolve) => {
      const unsubscribe = subscribeToTodos(uid, (data) => {
        const todos = data ? Object.entries(data).map(([id, t]) => ({ id, ...t })) : [];
        dispatch(setTodos(todos));
      });

      // Store unsubscribe function
      dispatch(setUnsubscribe(unsubscribe));
      resolve();
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
    },
    setUnsubscribe: (state, action) => {
      state.unsubscribe = action.payload;
    },
    cleanupSubscription: (state) => {
      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }
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

export const { setTodos, resetTodos, setUnsubscribe, cleanupSubscription } = todoSlice.actions;
export default todoSlice.reducer;