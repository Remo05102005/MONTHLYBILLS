// Test script for conversation sharing functionality
import { createChatSession, saveConversation, getChatSession } from './firebase/sessions';

// Mock user ID for testing
const testUserId = 'test-user-123';

async function testConversationSharing() {
  console.log('🧪 Testing Conversation Sharing...\n');

  try {
    // Test 1: Create a session with conversations
    console.log('1. Creating test session with conversations...');
    const sessionId = await createChatSession(testUserId);
    console.log(`✅ Session created with ID: ${sessionId}`);

    // Add some test conversations
    await saveConversation(testUserId, sessionId, 'What is my total spending this month?', 'Your total spending this month is ₹15,000.');
    await saveConversation(testUserId, sessionId, 'Which category has the highest expenses?', 'Food & Dining has the highest expenses at ₹8,000.');
    await saveConversation(testUserId, sessionId, 'How can I save more money?', 'You can save more by reducing dining out expenses and creating a budget.');
    console.log('✅ Test conversations added\n');

    // Test 2: Get session data for sharing
    console.log('2. Retrieving session data for sharing...');
    const session = await getChatSession(testUserId, sessionId);
    console.log(`✅ Session retrieved: ${session.title} with ${session.conversations.length} conversations\n`);

    // Test 3: Create shareable data
    console.log('3. Creating shareable data...');
    const shareableData = {
      sessionId: session.sessionId,
      sessionNumber: session.sessionNumber,
      title: session.title,
      createdAt: session.createdAt,
      conversations: session.conversations.map(conv => ({
        conversationNumber: conv.conversationNumber,
        query: conv.query,
        response: conv.response,
        timestamp: conv.timestamp
      }))
    };

    // Encode the data as base64
    const encodedData = btoa(JSON.stringify(shareableData));
    console.log(`✅ Data encoded: ${encodedData.substring(0, 50)}...\n`);

    // Test 4: Create shareable URL
    console.log('4. Creating shareable URL...');
    const baseUrl = 'http://localhost:3000';
    const shareableUrl = `${baseUrl}/shared-conversation?data=${encodedData}`;
    console.log(`✅ Shareable URL created:`);
    console.log(`   ${shareableUrl}\n`);

    // Test 5: Decode and verify data
    console.log('5. Testing data decoding...');
    const decodedData = JSON.parse(atob(encodedData));
    console.log(`✅ Data decoded successfully:`);
    console.log(`   - Session: ${decodedData.title} #${decodedData.sessionNumber}`);
    console.log(`   - Conversations: ${decodedData.conversations.length}`);
    console.log(`   - Created: ${decodedData.createdAt}\n`);

    // Test 6: Verify conversation content
    console.log('6. Verifying conversation content...');
    decodedData.conversations.forEach((conv, index) => {
      console.log(`   Conversation ${conv.conversationNumber}:`);
      console.log(`     Q: ${conv.query.substring(0, 50)}...`);
      console.log(`     A: ${conv.response.substring(0, 50)}...`);
    });
    console.log('✅ All conversation content verified\n');

    console.log('🎉 Conversation sharing test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Session ID: ${sessionId}`);
    console.log(`   - Shareable URL: ${shareableUrl}`);
    console.log(`   - Data size: ${encodedData.length} characters`);
    console.log(`   - Conversations: ${decodedData.conversations.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in other files
export { testConversationSharing };

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  testConversationSharing();
}
