# AcadPulse-AI Android Application Configuration

This directory contains the Android application configuration for **AcadPulse-AI** (`academicai.app`).

### Firebase Android Credentials & SDK Specs
- **Application ID / Package Name**: `academicai.app`
- **Firebase Project ID**: `aipowerd-academic`
- **Mobile SDK App ID**: `1:240838468110:android:487efaac588d5df719d25f`
- **OAuth Client ID**: `240838468110-ibo1h3htjnl4ju2agl6ouehtias6c3te.apps.googleusercontent.com`
- **Configuration File**: `android/app/google-services.json` (also stored in project root `/google-services.json`)

### Gradle Setup
1. **Project-level `build.gradle.kts`**:
   Includes Google services Gradle plugin:
   ```kotlin
   id("com.google.gms.google-services") version "4.5.0" apply false
   ```

2. **Module-level `app/build.gradle.kts`**:
   ```kotlin
   plugins {
       id("com.android.application")
       id("com.google.gms.google-services")
   }

   dependencies {
       implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
       implementation("com.google.firebase:firebase-auth")
       implementation("com.google.firebase:firebase-firestore")
   }
   ```

### Real-time Multi-Platform Synchronization
Both the **AcadPulse-AI Android App** and the **AcadPulse-AI Web App** share the identical Firebase Firestore project (`aipowerd-academic`). Any task completed, added, or modified on an Android device synchronizes instantly with the web dashboard via real-time Firestore listeners.
