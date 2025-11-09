# Capacitor Setup Guide for Push Notifications

This guide explains how to set up Capacitor for native mobile apps with push notifications.

## 📱 **Capacitor Integration Overview**

The todo list app now supports both **web browsers** and **native mobile apps** (iOS/Android) through Capacitor. Push notifications work seamlessly in both environments.

### **How It Works**
- **Web**: Uses Firebase Cloud Messaging with service workers
- **Capacitor**: Uses native push notification APIs via Capacitor plugins
- **Automatic Detection**: App detects environment and uses appropriate method

---

## 🚀 **Setup Steps**

### **1. Install Capacitor CLI**
```bash
npm install -g @capacitor/cli
```

### **2. Initialize Capacitor**
```bash
# Initialize Capacitor in your project
npx cap init

# When prompted:
# - App name: COMMON MAN
# - App ID: com.remo.commonman
# - Web asset directory: www
```

### **3. Add Platforms**
```bash
# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios
```

### **4. Install Dependencies**
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/push-notifications
npm install @capacitor/android @capacitor/ios
```

### **5. Configure Firebase for Native Apps**

#### **Android Configuration**
1. Download `google-services.json` from Firebase Console
2. Place it in `android/app/google-services.json`

#### **iOS Configuration**
1. Download `GoogleService-Info.plist` from Firebase Console
2. Place it in `ios/App/App/GoogleService-Info.plist`

### **6. Update capacitor.config.json**
```json
{
  "appId": "com.remo.commonman",
  "appName": "COMMON MAN",
  "webDir": "www",
  "server": {
    "url": "https://aadhayavyaya.netlify.app/",
    "cleartext": true
  },
  "plugins": {
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }
  }
}
```

### **7. Build and Sync**
```bash
# Build the web app
npm run build

# Copy web assets to native projects
npx cap sync

# For Android
npx cap sync android

# For iOS
npx cap sync ios
```

---

## 📲 **Platform-Specific Setup**

### **Android Setup**

#### **1. Update AndroidManifest.xml**
Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<!-- Add inside <application> tag -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="todo_high" />

<!-- Add notification channels -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@mipmap/ic_launcher" />
```

#### **2. Create Notification Channels**
Add to `android/app/src/main/java/com/remo/commonman/MainActivity.java`:
```java
// Add imports
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

// Add to onCreate method
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    NotificationChannel highChannel = new NotificationChannel(
        "todo_high",
        "High Priority Todos",
        NotificationManager.IMPORTANCE_HIGH
    );
    highChannel.setDescription("High priority todo notifications");

    NotificationChannel mediumChannel = new NotificationChannel(
        "todo_medium",
        "Medium Priority Todos",
        NotificationManager.IMPORTANCE_DEFAULT
    );
    mediumChannel.setDescription("Medium priority todo notifications");

    NotificationChannel lowChannel = new NotificationChannel(
        "todo_low",
        "Low Priority Todos",
        NotificationManager.IMPORTANCE_LOW
    );
    lowChannel.setDescription("Low priority todo notifications");

    NotificationManager notificationManager = getSystemService(NotificationManager.class);
    notificationManager.createNotificationChannel(highChannel);
    notificationManager.createNotificationChannel(mediumChannel);
    notificationManager.createNotificationChannel(lowChannel);
}
```

### **iOS Setup**

#### **1. Update AppDelegate.swift**
Add to `ios/App/App/AppDelegate.swift`:
```swift
// Add imports
import Firebase
import FirebaseMessaging

// Add to application:didFinishLaunchingWithOptions
FirebaseApp.configure()
Messaging.messaging().delegate = self

// Add notification categories
let completeAction = UNNotificationAction(identifier: "COMPLETE_ACTION", title: "Mark Complete", options: [])
let snoozeAction = UNNotificationAction(identifier: "SNOOZE_ACTION", title: "Snooze 1h", options: [])
let viewAction = UNNotificationAction(identifier: "VIEW_ACTION", title: "View Details", options: [.foreground])

let highCategory = UNNotificationCategory(identifier: "TODO_HIGH", actions: [completeAction, snoozeAction, viewAction], intentIdentifiers: [], options: [])
let mediumCategory = UNNotificationCategory(identifier: "TODO_MEDIUM", actions: [completeAction, viewAction], intentIdentifiers: [], options: [])
let lowCategory = UNNotificationCategory(identifier: "TODO_LOW", actions: [viewAction], intentIdentifiers: [], options: [])

UNUserNotificationCenter.current().setNotificationCategories([highCategory, mediumCategory, lowCategory])

// Add FCM delegate methods
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("FCM registration token: \(fcmToken ?? "nil")")
    }
}
```

#### **2. Update Info.plist**
Add to `ios/App/App/Info.plist`:
```xml
<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

---

## 🔧 **Code Integration**

### **Initialize Capacitor in index.js**
```javascript
// Add to src/index.js
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Initialize Capacitor
defineCustomElements(window);
```

### **Notification Service Auto-Detection**
The notification service automatically detects the environment:

```javascript
// Web environment: Uses service workers
// Capacitor environment: Uses native push APIs

if (isCapacitor()) {
  // Use Capacitor Push Notifications plugin
  const { PushNotifications } = await import('@capacitor/push-notifications');
  // ... Capacitor-specific setup
} else {
  // Use web service workers
  // ... Web-specific setup
}
```

---

## 🧪 **Testing Push Notifications**

### **Web Testing**
```bash
# Start development server
npm start

# Open browser dev tools → Application → Service Workers
# Test notifications in browser
```

### **Android Testing**
```bash
# Build and run on device/emulator
npx cap run android

# Use Firebase Console to send test notifications
# Or use Android Studio logcat to monitor
```

### **iOS Testing**
```bash
# Build and run on device/simulator
npx cap run ios

# Use Firebase Console to send test notifications
# Monitor Xcode console for logs
```

---

## 🔐 **Firebase Configuration**

### **Update Firebase Config for Native**
```javascript
// Ensure firebase config includes both web and native settings
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  // Add for iOS
  iosAppId: "...",
  // Add for Android
  androidAppId: "..."
};
```

### **FCM Server Key**
- Get server key from Firebase Console → Project Settings → Cloud Messaging
- Use this key in your backend for sending notifications

---

## 🚀 **Deployment**

### **Web Deployment**
```bash
npm run build
npx cap sync
# Deploy www folder to hosting
```

### **Android Deployment**
```bash
npx cap build android
# Open android project in Android Studio
# Build APK/AAB for Play Store
```

### **iOS Deployment**
```bash
npx cap build ios
# Open ios project in Xcode
# Build IPA for App Store
```

---

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Notifications not working on Android**
- Check `google-services.json` is in correct location
- Verify notification channels are created
- Check AndroidManifest.xml permissions

#### **Notifications not working on iOS**
- Verify `GoogleService-Info.plist` is added
- Check notification permissions in iOS Settings
- Ensure background modes are enabled

#### **Web notifications not working**
- Check service worker is registered
- Verify HTTPS (required for notifications)
- Check browser notification permissions

### **Debug Commands**
```bash
# Check Capacitor setup
npx cap doctor

# View platform info
npx cap ls

# Clean and rebuild
npx cap clean
npx cap sync
```

---

## 📊 **Notification Analytics**

### **Tracking Delivery**
- Firebase Console shows delivery statistics
- Local storage tracks notification history
- Custom analytics for user engagement

### **Performance Monitoring**
- Notification delivery rates
- User interaction patterns
- Platform-specific success rates

---

## 🎯 **Key Benefits**

✅ **Universal Compatibility**: Works on web, Android, and iOS
✅ **Native Performance**: True native notifications on mobile
✅ **Seamless Integration**: Same codebase for all platforms
✅ **Rich Features**: Actions, priority, custom sounds
✅ **Reliable Delivery**: Firebase ensures message delivery
✅ **Easy Maintenance**: Single notification service for all platforms

---

## 📞 **Support**

For issues with Capacitor setup:
- Check Capacitor documentation: https://capacitorjs.com
- Firebase troubleshooting: https://firebase.google.com/docs/cloud-messaging
- Community forums: https://forum.ionicframework.com

The notification system is now fully compatible with Capacitor native apps! 🎉
