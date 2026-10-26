package com.diamondninebaseball.game;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Never hold the splash longer than this, even if the page never reports ready.
    private static final long SPLASH_MAX_MS = 4000;

    @Override public void onCreate(Bundle state) {
        // Android 12+ system splash (and the compat splash below 12): keep it until the web
        // loading screen is on screen, then fade it out. Without this the splash vanished at the
        // first frame and a blank WebView flashed before the game appeared.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        final long start = SystemClock.uptimeMillis();
        LaunchScreenPlugin.ready = false;
        splash.setKeepOnScreenCondition(() -> !LaunchScreenPlugin.ready && SystemClock.uptimeMillis() - start < SPLASH_MAX_MS);
        splash.setOnExitAnimationListener(provider -> {
            View v = provider.getView();
            v.animate().alpha(0f).setDuration(220).withEndAction(provider::remove).start();
        });
        registerPlugin(PointStorePlugin.class);
        registerPlugin(LaunchScreenPlugin.class);
        super.onCreate(state);
    }
}
