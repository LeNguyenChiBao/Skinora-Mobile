# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# Skinora Mobile App

## Video Call Setup

To enable real video calling, you need to install react-native-agora:

### Installation Steps:

1. Install the package:

   ```bash
   npm install react-native-agora
   ```

2. For React Native >= 0.60 (auto-linking):

   ```bash
   npx react-native run-android
   ```

3. For older versions:

   ```bash
   npx react-native link react-native-agora
   ```

4. Add permissions to `android/app/src/main/AndroidManifest.xml`:

   ```xml
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```

### Demo Mode

If Agora SDK is not available, the app will automatically run in demo mode with:

- Simulated video call interface
- Working controls (mute, camera, etc.)
- Call timer and status updates
- Visual placeholders for video streams

### Troubleshooting

If you see "RtcEngine not found", try:

1. Clean and rebuild: `npx react-native clean && npx react-native run-android`
2. Check if the package is properly linked
3. Ensure you're not running on Expo Go (native build required)
