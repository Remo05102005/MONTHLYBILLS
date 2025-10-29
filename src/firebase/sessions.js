import { ref, push, set, get, child, onValue, off, remove, update, query, orderByChild, limitToLast } from 'firebase/database';
import { realtimeDb } from './config';

// Session management for Subbarao chats
export const createChatSession = async (userId) => {
  try {
    // Get the next session number for this user
    const sessionsRef = ref(realtimeDb, `users/${userId}/sessions`);
    const sessionsSnapshot = await get(sessionsRef);
    
    let nextSessionNumber = 1;
    if (sessionsSnapshot.exists()) {
      const sessions = sessionsSnapshot.val();
      const sessionNumbers = Object.values(sessions).map(session => session.sessionNumber || 0);
      nextSessionNumber = Math.max(...sessionNumbers) + 1;
    }
    
    const newSessionRef = push(sessionsRef);
    
    const sessionData = {
      sessionId: newSessionRef.key,
      sessionNumber: nextSessionNumber,
      userId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: `Chat Session ${nextSessionNumber}`,
      conversations: {},
      conversationCount: 0,
      isActive: true,
      timeline: null,
      customStartDate: null,
      customEndDate: null
    };
    
    await set(newSessionRef, sessionData);
    return newSessionRef.key;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

export const saveConversation = async (userId, sessionId, query, response, timelineData = null) => {
  try {
    // Get current session to determine next conversation number
    const sessionRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}`);
    const sessionSnapshot = await get(sessionRef);
    
    if (!sessionSnapshot.exists()) {
      throw new Error('Session not found');
    }
    
    const sessionData = sessionSnapshot.val();
    const nextConversationNumber = (sessionData.conversationCount || 0) + 1;
    
    // Save conversation with serial number
    const conversationRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}/conversations/${nextConversationNumber}`);
    const conversationData = {
      conversationNumber: nextConversationNumber,
      query: query,
      response: response,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      sessionNumber: sessionData.sessionNumber,
      userId: userId
    };
    
    await set(conversationRef, conversationData);
    
    // Update session with new conversation count and title
    const newTitle = query.length > 30 
      ? query.substring(0, 30) + '...'
      : query;
    
    // Prepare update data
    const updateData = {
      conversationCount: nextConversationNumber,
      updatedAt: new Date().toISOString(),
      title: sessionData.conversationCount === 0 ? newTitle : sessionData.title
    };
    
    // If first conversation, store timeline data for session
    if (sessionData.conversationCount === 0 && timelineData) {
      updateData.timeline = timelineData.timeline;
      updateData.customStartDate = timelineData.customStartDate;
      updateData.customEndDate = timelineData.customEndDate;
    }
    
    await update(sessionRef, updateData);

    // Maintain a short-term memory buffer on the session (last 10 messages)
    try {
      const memoryRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}/memoryBuffer`);
      const existingMemorySnapshot = await get(memoryRef);
      const existing = existingMemorySnapshot.exists() ? existingMemorySnapshot.val() : [];
      const newMem = existing || [];
      newMem.push({ type: 'user', content: query, timestamp: new Date().toISOString() });
      newMem.push({ type: 'ai', content: response, timestamp: new Date().toISOString() });
      // Keep last 10 entries
      const trimmed = newMem.slice(-10);
      await set(memoryRef, trimmed);
    } catch (memErr) {
      console.error('Error updating session memory buffer:', memErr);
    }
    
    return nextConversationNumber;
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

export const getChatSessions = async (userId) => {
  try {
    const sessionsRef = ref(realtimeDb, `users/${userId}/sessions`);
    const snapshot = await get(sessionsRef);
    
    if (snapshot.exists()) {
      const sessions = [];
      snapshot.forEach((childSnapshot) => {
        const session = childSnapshot.val();
        // Only include sessions with conversations
        if (session.conversationCount > 0) {
          sessions.push({
            id: childSnapshot.key,
            ...session
          });
        }
      });
      
      // Sort by session number descending (newest first)
      return sessions.sort((a, b) => b.sessionNumber - a.sessionNumber);
    }
    
    return [];
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    return [];
  }
};

export const getChatSession = async (userId, sessionId) => {
  try {
    const sessionRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}`);
    const snapshot = await get(sessionRef);
    
    if (snapshot.exists()) {
      const sessionData = snapshot.val();
      
      // Convert conversations object to array and sort by conversation number
      const conversationsArray = Object.values(sessionData.conversations || {})
        .sort((a, b) => a.conversationNumber - b.conversationNumber);
      
      return {
        id: sessionId,
        ...sessionData,
        conversations: conversationsArray
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting chat session:', error);
    return null;
  }
};

export const deleteChatSession = async (userId, sessionId) => {
  try {
    const sessionRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}`);
    await remove(sessionRef);
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

export const updateSessionTitle = async (userId, sessionId, title) => {
  try {
    const sessionRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}`);
    await update(sessionRef, { 
      title: title,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating session title:', error);
    throw error;
  }
};

export const listenToChatSessions = (userId, callback) => {
  const sessionsRef = ref(realtimeDb, `users/${userId}/sessions`);
  
  const unsubscribe = onValue(sessionsRef, (snapshot) => {
    if (snapshot.exists()) {
      const sessions = [];
      snapshot.forEach((childSnapshot) => {
        const session = childSnapshot.val();
        // Only include sessions with conversations
        if (session.conversationCount > 0) {
          sessions.push({
            id: childSnapshot.key,
            ...session
          });
        }
      });
      
      // Sort by session number descending (newest first)
      const sortedSessions = sessions.sort((a, b) => b.sessionNumber - a.sessionNumber);
      callback(sortedSessions);
    } else {
      callback([]);
    }
  });
  
  return unsubscribe;
};

export const listenToChatSession = (userId, sessionId, callback) => {
  const sessionRef = ref(realtimeDb, `users/${userId}/sessions/${sessionId}`);
  
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      const sessionData = snapshot.val();
      
      // Convert conversations object to array and sort by conversation number
      const conversationsArray = Object.values(sessionData.conversations || {})
        .sort((a, b) => a.conversationNumber - b.conversationNumber);
      
      callback({
        id: sessionId,
        ...sessionData,
        conversations: conversationsArray
      });
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
};

// Create a public share entry for a session's data so we can share a short link
export const createPublicShare = async (userId, sessionId, payload) => {
  try {
    const sharesRef = ref(realtimeDb, `public_shares`);
    const newShareRef = push(sharesRef);

    const shareData = {
      owner: userId,
      sessionId: sessionId,
      payload: payload,
      createdAt: new Date().toISOString()
    };

    await set(newShareRef, shareData);
    return newShareRef.key;
  } catch (error) {
    console.error('Error creating public share:', error);
    throw error;
  }
};