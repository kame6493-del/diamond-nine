package com.diamondninebaseball.game;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The web page calls ready() once its own loading screen has been painted, so the system
 *  splash hands over to a screen that looks the same instead of a blank WebView. */
@CapacitorPlugin(name = "LaunchScreen")
public class LaunchScreenPlugin extends Plugin {
    static volatile boolean ready = false;

    @PluginMethod
    public void ready(PluginCall call) {
        ready = true;
        call.resolve();
    }
}
