package com.diamondninebaseball.game;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(PointStorePlugin.class);
        super.onCreate(state);
    }
}
