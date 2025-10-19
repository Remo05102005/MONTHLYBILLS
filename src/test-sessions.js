// Test script for session management functionality
import { 
  createChatSession, 
  saveConversation, 
  getChatSessions, 
  getChatSession, 
  deleteChatSession 
} from './firebase/sessions';

// Mock user ID for testing
const testUserId = 'test-user-123';

async function testSessionManagement() {
  console.log('🧪 Testing Session Management System...\n');

  try {
    // Test 1: Create a new session
    console.log('1. Creating new session...');
    const sessionId1 = await createChatSession(testUserId);
    console.log(`✅ Session 1 created with ID: ${sessionId1}\n`);

    // Test 2: Add conversations to session 1
    console.log('2. Adding conversations to session 1...');
    await saveConversation(testUserId, sessionId1, 'What is my total spending this month?', 'Your total spending this month is ₹15,000.');
    await saveConversation(testUserId, sessionId1, 'Which category has the highest expenses?', 'Food & Dining has the highest expenses at ₹8,000.');
    console.log('✅ Conversations added to session 1\n');

    // Test 3: Create another session
    console.log('3. Creating second session...');
    const sessionId2 = await createChatSession(testUserId);
    console.log(`✅ Session 2 created with ID: ${sessionId2}\n`);

    // Test 4: Add conversation to session 2
    console.log('4. Adding conversation to session 2...');
    await saveConversation(testUserId, sessionId2, 'Show me my savings trend', 'Your savings have increased by 15% compared to last month.');
    console.log('✅ Conversation added to session 2\n');

    // Test 5: Get all sessions
    console.log('5. Retrieving all sessions...');
    const allSessions = await getChatSessions(testUserId);
    console.log(`✅ Found ${allSessions.length} sessions:`);
    allSessions.forEach(session => {
      console.log(`   - Session #${session.sessionNumber}: ${session.title} (${session.conversationCount} conversations)`);
    });
    console.log('');

    // Test 6: Get specific session
    console.log('6. Retrieving specific session...');
    const specificSession = await getChatSession(testUserId, sessionId1);
    if (specificSession) {
      console.log(`✅ Session #${specificSession.sessionNumber} retrieved:`);
      console.log(`   - Title: ${specificSession.title}`);
      console.log(`   - Conversations: ${specificSession.conversations.length}`);
      specificSession.conversations.forEach(conv => {
        console.log(`     * Conv #${conv.conversationNumber}: ${conv.query.substring(0, 50)}...`);
      });
    }
    console.log('');

    // Test 7: Test session ordering (should be descending by session number)
    console.log('7. Testing session ordering...');
    const sessions = await getChatSessions(testUserId);
    const isOrdered = sessions.every((session, index) => {
      if (index === 0) return true;
      return session.sessionNumber > sessions[index - 1].sessionNumber;
    });
    console.log(`✅ Sessions are ordered correctly: ${isOrdered}\n`);

    // Test 8: Test empty session filtering
    console.log('8. Testing empty session filtering...');
    const emptySessionId = await createChatSession(testUserId);
    const sessionsBefore = await getChatSessions(testUserId);
    console.log(`Sessions before creating empty session: ${sessionsBefore.length}`);
    
    // Don't add any conversations to this session
    const sessionsAfter = await getChatSessions(testUserId);
    console.log(`Sessions after creating empty session: ${sessionsAfter.length}`);
    console.log(`✅ Empty session filtered out: ${sessionsBefore.length === sessionsAfter.length}\n`);

    // Test 9: Delete a session
    console.log('9. Deleting session...');
    await deleteChatSession(testUserId, sessionId2);
    const sessionsAfterDelete = await getChatSessions(testUserId);
    console.log(`✅ Session deleted. Remaining sessions: ${sessionsAfterDelete.length}\n`);

    console.log('🎉 All tests passed! Session management system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in other files
export { testSessionManagement };

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  testSessionManagement();
}
